import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '@db';
import { users } from '@db/users';
import { userCreditLimits } from '@db/user-credit-limits';
import {
  allocateKatmClaimId,
  createKatmConsent,
  missingKatmFields,
  runScoringPipeline,
  type PipelineStepResult,
} from '../../integrations/katm/flow';
import { enqueueKatmPoll } from '../../integrations/katm/poller';
import {
  loadLatestClientScoring,
  setKatmClaimIdOnScoring,
  startClientScoringRun,
} from '../../scoring/pipelines/store';
import {
  REJECT_REASON_CATEGORY,
  type ScoringRejectReasonCode,
} from '../../scoring/pipelines/types';
import type { GENDERS } from '../../integrations/katm/service/shared';
import { applyClientStep, finalizeClientScoringIfReady } from './finalize';

// ---------------------------------------------------------------------------
// Client Scoring — a user self-scores in the mobile app to learn their credit
// limit. Clones the merchant pipeline (myid → 077 → INPS → model) but anchored
// on the user (no deal_session). start fires KATM; the model runs server-side
// once KATM resolves AND a card is on file (see scoring/finalize.ts). The app
// polls GET /status. A valid (unexpired) limit is reused without re-charging.
// ---------------------------------------------------------------------------

const SECURITY = [{ clientAuth: [] }];
const ERROR = { $ref: 'ErrorResponse#' };

function reasonCategory(code: string) {
  return REJECT_REASON_CATEGORY[code as ScoringRejectReasonCode] ?? 'ineligible';
}

export default async function clientScoringRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Client · Scoring'];
  const guards = [app.verifyClientJwt];

  const StartBody = Type.Object({
    cardId: Type.Optional(Type.String({ minLength: 1 })),
  });

  const StartResponse = Type.Object({
    status: Type.Union([
      Type.Literal('cached'),
      Type.Literal('pending'),
      Type.Literal('awaiting_card'),
      Type.Literal('scored'),
      Type.Literal('rejected'),
      Type.Literal('failed'),
      Type.Literal('error'),
    ]),
    creditLimit: Type.Optional(Type.String()),
    expiresAt: Type.Optional(Type.String()),
    reasonCode: Type.Optional(Type.String()),
    reasonCategory: Type.Optional(Type.String()),
    missingFields: Type.Optional(Type.Array(Type.String())),
    reason: Type.Optional(Type.String()),
  });

  /* ── POST /client/scoring/start — begin (or reuse) a scoring run ────────── */

  fastify.post(
    '/start',
    {
      schema: {
        tags: TAGS,
        summary: 'Start scoring',
        security: SECURITY,
        body: StartBody,
        response: { 200: StartResponse, 400: ERROR, 401: ERROR, 404: ERROR },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      const userId = Number(request.user.sub);

      // Reuse a still-valid limit — no fresh bureau charge within the TTL.
      const [limit] = await db
        .select()
        .from(userCreditLimits)
        .where(eq(userCreditLimits.userId, userId))
        .limit(1);
      if (limit && limit.expiresAt.getTime() > Date.now()) {
        return {
          status: 'cached' as const,
          creditLimit: limit.creditLimit,
          expiresAt: limit.expiresAt.toISOString(),
        };
      }

      // A run already underway must not re-fire chargeable KATM. 'in_progress' =
      // bureau still running → pending. 'passed' = KATM already cleared, only the
      // card/model remains → finalize if a card now exists, else awaiting_card.
      const latest = await loadLatestClientScoring(userId);
      if (latest?.status === 'in_progress') return { status: 'pending' as const };
      if (latest?.status === 'passed') {
        const outcome = await finalizeClientScoringIfReady(userId);
        return outcome?.status === 'scored'
          ? { status: 'scored' as const, creditLimit: outcome.creditLimit }
          : { status: 'awaiting_card' as const };
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return reply.code(404).sendError('user_not_found');

      // Profile incompleteness is fixable, not a decline — surface it without
      // opening a run or writing a 0 limit.
      const missing = missingKatmFields(user);
      if (missing.length) {
        return {
          status: 'rejected' as const,
          reasonCode: 'data_missing',
          reasonCategory: 'data_missing',
          missingFields: missing,
        };
      }

      const consent = await createKatmConsent({ userId });
      const claimId = await allocateKatmClaimId();

      let scoring;
      try {
        scoring = await startClientScoringRun(userId);
      } catch (err) {
        // Lost the race to the partial unique index — another run is in flight.
        if ((err as { code?: string })?.code === '23505') return { status: 'pending' as const };
        throw err;
      }
      await setKatmClaimIdOnScoring(scoring.id, claimId);

      const step: PipelineStepResult = await runScoringPipeline({
        scoringId: scoring.id,
        claimId,
        consent,
        subject: {
          pinfl: user.pinfl,
          passportSerial: user.passportSeries!,
          passportNumber: user.passportNumber!,
          docType: user.docType!,
          regionCode: user.regionCode!,
          districtCode: user.districtCode!,
          address: user.address!,
          phone: user.phone,
          birthDate: user.birthDate,
          gender: user.gender as GENDERS,
          citizenShipId: user.citizenShipId ?? '',
        },
        userId,
      });

      const outcome = await applyClientStep(step, scoring);
      switch (outcome.status) {
        case 'pending':
          await enqueueKatmPoll(app.katmPollQueue, {
            scoringId: scoring.id,
            origin: 'client',
            claimId,
            consentId: consent.agreementId,
            consentDate: consent.agreementDate.toISOString(),
            token: outcome.enqueue.token,
            reportType: outcome.enqueue.reportType,
          });
          return { status: 'pending' as const };
        case 'rejected':
          return {
            status: 'rejected' as const,
            reasonCode: outcome.reasonCode,
            reasonCategory: reasonCategory(outcome.reasonCode),
            ...(outcome.missingFields ? { missingFields: outcome.missingFields } : {}),
          };
        case 'failed':
          return { status: 'rejected' as const, reason: outcome.reason };
        case 'scored':
          return { status: 'scored' as const, creditLimit: outcome.creditLimit };
        case 'error':
          return { status: 'error' as const };
      }
    },
  );

  /* ── GET /client/scoring/status — current run + limit ───────────────────── */

  const StatusResponse = Type.Object({
    status: Type.Union([
      Type.Literal('none'),
      Type.Literal('pending'),
      Type.Literal('awaiting_card'),
      Type.Literal('scored'),
      Type.Literal('rejected'),
      Type.Literal('error'),
    ]),
    creditLimit: Type.Union([Type.String(), Type.Null()]),
    expiresAt: Type.Union([Type.String(), Type.Null()]),
    // True once the stored limit is past its TTL — the app offers a refresh.
    expired: Type.Boolean(),
    reasonCode: Type.Union([Type.String(), Type.Null()]),
  });

  fastify.get(
    '/status',
    {
      schema: {
        tags: TAGS,
        summary: 'Scoring status',
        description: "The user's latest scoring run and current stored credit limit.",
        security: SECURITY,
        response: { 200: StatusResponse, 401: ERROR },
      },
      preHandler: guards,
    },
    async (request) => {
      const userId = Number(request.user.sub);
      const [scoring, [limit]] = await Promise.all([
        loadLatestClientScoring(userId),
        db.select().from(userCreditLimits).where(eq(userCreditLimits.userId, userId)).limit(1),
      ]);

      const status = !scoring
        ? ('none' as const)
        : scoring.status === 'in_progress'
          ? ('pending' as const)
          : scoring.status === 'passed'
            ? ('awaiting_card' as const)
            : scoring.status === 'scored'
              ? ('scored' as const)
              : scoring.status === 'rejected'
                ? ('rejected' as const)
                : ('error' as const);

      return {
        status,
        creditLimit: limit ? limit.creditLimit : null,
        expiresAt: limit ? limit.expiresAt.toISOString() : null,
        expired: limit ? limit.expiresAt.getTime() <= Date.now() : false,
        reasonCode: scoring?.status === 'rejected' ? (scoring.rejectReasonCode ?? null) : null,
      };
    },
  );
}
