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
import { loadBlockingDeal } from '../../deals/blocking';
import {
  loadLatestClientScoring,
  setKatmClaimIdOnScoring,
  startClientScoringRun,
} from '../../scoring/pipelines/store';
import {
  REJECT_REASON_CATEGORY,
  type ScoringRejectReasonCode,
} from '../../scoring/pipelines/types';
import { resolveLang } from '../../../i18n/index';
import { reasonMessage } from '../../../i18n/reason-codes';
import type { GENDERS } from '../../integrations/katm/service/shared';
import {
  applyClientStep,
  finalizeClientScoringIfReady,
  hasScoreableCard,
  resumeErroredClientRun,
} from './finalize';
import { loadLimitOffers } from './limit';

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
    reasonMessage: Type.Optional(Type.String()),
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
      const lang = resolveLang(request.headers['x-lang'] as string | undefined);

      // One Active Deal — the client's limit was consumed by the deal they are
      // still paying off. Answered before a run is opened: the block lifts the day
      // that deal closes, so it must not cost them a scoring row or a cooldown.
      // The active_deal pipeline stage is the authority (and catches the merchant
      // path); this is just the cheap early exit, as data_missing is below.
      // TODO need ot uncommit before production
      // if (await loadBlockingDeal(userId)) {
      //   return {
      //     status: 'rejected' as const,
      //     reasonCode: 'active_deal_exists',
      //     reasonCategory: reasonCategory('active_deal_exists'),
      //     reasonMessage: reasonMessage(lang, 'active_deal_exists'),
      //   };
      // }

      // Reuse a still-valid limit — no fresh bureau charge within the TTL.
      const [limit] = await db
        .select()
        .from(userCreditLimits)
        .where(eq(userCreditLimits.userId, userId))
        .limit(1);
      if (limit && limit.expiresAt.getTime() > Date.now()) {
        if (Number(limit.creditLimit) > 0) {
          return {
            status: 'scored' as const,
            creditLimit: limit.creditLimit,
            expiresAt: limit.expiresAt.toISOString(),
          };
        }
        // A zero limit inside its TTL is not a cached limit of nothing — it is the
        // cooldown a durable rejection leaves behind, and the TTL is what stops the
        // client re-firing chargeable KATM. Hold the line, but say what it is: the
        // run that set it still carries the reason.
        const declined = await loadLatestClientScoring(userId);
        const reasonCode = declined?.rejectReasonCode ?? 'zero_limit';
        return {
          status: 'rejected' as const,
          reasonCode,
          reasonCategory: reasonCategory(reasonCode),
          reasonMessage: reasonMessage(lang, reasonCode),
        };
      }

      // A run already underway must not re-fire chargeable KATM. 'in_progress' =
      // bureau still running → pending. 'passed' = KATM already cleared, only the
      // card scoring / model remains → advance it as far as it will go.
      const latest = await loadLatestClientScoring(userId);
      if (latest?.status === 'in_progress') return { status: 'pending' as const };
      if (latest?.status === 'passed') {
        const outcome = await finalizeClientScoringIfReady(userId);
        if (outcome?.status === 'scored') {
          return { status: 'scored' as const, creditLimit: outcome.creditLimit };
        }
        if (outcome?.status === 'rejected') {
          return {
            status: 'rejected' as const,
            reasonCode: outcome.reasonCode,
            reasonCategory: reasonCategory(outcome.reasonCode),
            reasonMessage: reasonMessage(lang, outcome.reasonCode),
          };
        }
        if (outcome?.status === 'error') {
          return { status: 'error' as const, reasonMessage: reasonMessage(lang) };
        }
        // Nothing terminal: either Plum is working (pending) or there is still no
        // scoreable card to work on.
        const after = await loadLatestClientScoring(userId);
        return after?.currentPipeline === 'plum_card'
          ? { status: 'pending' as const }
          : { status: 'awaiting_card' as const };
      }
      // A run that died at the card-scoring stage is re-drivable on its own: the
      // bureau reports it already paid for are still stored under its claimId, so
      // resume it rather than opening a run that would buy them again.
      if (latest?.status === 'error') {
        const resumed = await resumeErroredClientRun(latest);
        if (resumed) {
          switch (resumed.status) {
            case 'scored':
              return { status: 'scored' as const, creditLimit: resumed.creditLimit };
            case 'rejected':
              return {
                status: 'rejected' as const,
                reasonCode: resumed.reasonCode,
                reasonCategory: reasonCategory(resumed.reasonCode),
                reasonMessage: reasonMessage(lang, resumed.reasonCode),
              };
            case 'awaiting_card':
              return { status: 'awaiting_card' as const };
            case 'error':
              return { status: 'error' as const, reasonMessage: reasonMessage(lang) };
            default:
              return { status: 'pending' as const };
          }
        }
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
          reasonMessage: reasonMessage(lang, 'data_missing'),
          missingFields: missing,
        };
      }

      // A scoreable card is a PRECONDITION now, not a later step: plum_card gates
      // the model, so a run opened without one can only ever stall or fail — after
      // the chargeable bureau reports have been bought. Refusing here costs the
      // applicant nothing (retryable, no run, no cooldown) and costs us nothing.
      if (!(await hasScoreableCard(userId))) {
        return {
          status: 'rejected' as const,
          reasonCode: 'card_required',
          reasonCategory: 'data_missing',
          reasonMessage: reasonMessage(lang, 'card_required'),
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
          // `enqueue` is absent when the wait is Plum's rather than KATM's — the
          // plum_card worker was queued by applyClientStep and owns the run from
          // here, so there is no follow-up report to poll for.
          if (outcome.enqueue) {
            await enqueueKatmPoll(app.katmPollQueue, {
              scoringId: scoring.id,
              origin: 'client',
              claimId,
              consentId: consent.agreementId,
              consentDate: consent.agreementDate.toISOString(),
              token: outcome.enqueue.token,
              reportType: outcome.enqueue.reportType,
            });
          }
          return { status: 'pending' as const };
        case 'awaiting_card':
          return { status: 'awaiting_card' as const };
        case 'rejected':
          return {
            status: 'rejected' as const,
            reasonCode: outcome.reasonCode,
            reasonCategory: reasonCategory(outcome.reasonCode),
            reasonMessage: reasonMessage(lang, outcome.reasonCode),
            ...(outcome.missingFields ? { missingFields: outcome.missingFields } : {}),
          };
        case 'failed':
          // Codeless operational failure — keep the internal `reason` string and
          // give the client the generic message rather than a raw reasonCode.
          return {
            status: 'rejected' as const,
            reason: outcome.reason,
            reasonMessage: reasonMessage(lang),
          };
        case 'scored':
          return { status: 'scored' as const, creditLimit: outcome.creditLimit };
        case 'error':
          return { status: 'error' as const, reasonMessage: reasonMessage(lang) };
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
    reasonMessage: Type.Union([Type.String(), Type.Null()]),
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
      const lang = resolveLang(request.headers['x-lang'] as string | undefined);
      const [scoring, [limit], blocking] = await Promise.all([
        loadLatestClientScoring(userId),
        db.select().from(userCreditLimits).where(eq(userCreditLimits.userId, userId)).limit(1),
        loadBlockingDeal(userId),
      ]);

      // An open deal outranks whatever the last run says. Without this the app
      // would read the stale 'scored' run left behind by the very scoring that
      // funded the deal, next to the limit row createDeal deleted, and render
      // "approved — for nothing".
      // TODO need to uncommit code below 
      // if (blocking) {
      //   return {
      //     status: 'rejected' as const,
      //     creditLimit: null,
      //     expiresAt: null,
      //     expired: false,
      //     reasonCode: 'active_deal_exists',
      //     reasonMessage: reasonMessage(lang, 'active_deal_exists'),
      //   };
      // }

      let status = !scoring
        ? ('none' as const)
        : scoring.status === 'in_progress'
          ? ('pending' as const)
          : scoring.status === 'passed'
            ? // 'passed' covers two very different waits. Parked on plum_card the
              // card IS on file and the vendor is working — reporting that as
              // 'awaiting_card' would tell the app to ask for a card it already has.
              scoring.currentPipeline === 'plum_card'
              ? ('pending' as const)
              : ('awaiting_card' as const)
            : scoring.status === 'scored'
              ? ('scored' as const)
              : scoring.status === 'rejected'
                ? ('rejected' as const)
                : ('error' as const);

      const reasonCode = scoring?.status === 'rejected' ? (scoring.rejectReasonCode ?? null) : null;
      const expired = limit ? limit.expiresAt.getTime() <= Date.now() : false;
      // A limit past its TTL is not a limit. The run that produced it still reads
      // 'scored' — runs are never rewritten — but there is nothing left to spend:
      // POST /start ignores an expired row and buys fresh bureau reports, and the
      // wizard refuses to reuse it. 'none' is what says that to the app, and the
      // `expired` flag below is what lets it word the prompt as "refresh" rather
      // than "get scored". Same treatment as a missing or empty limit row.
      if (status === 'scored' && (!limit || !limit.creditLimit || expired)) {
        status = 'none';
      }

      return {
        status,
        creditLimit: limit ? limit.creditLimit : null,
        expiresAt: limit ? limit.expiresAt.toISOString() : null,
        expired,
        reasonCode,
        reasonMessage: status === 'rejected' ? reasonMessage(lang, reasonCode ?? undefined) : null,
      };
    },
  );

  const LimitResponse = Type.Array(
    Type.Object({
      months: Type.Integer(),
      amount: Type.Number(),
    }),
  );

  /* ── GET /client/scoring/limit — the limit as a menu of terms ───────────── */
  fastify.get(
    '/limit',
    {
      schema: {
        tags: TAGS,
        summary: 'Credit limit by term',
        description:
          'The stored per-month limit scaled by each offered term, capped at ' +
          '30 000 000 som. `amount` is what the client would OWE over the term — ' +
          'the wizard checks the marked-up basket total against it — so it is NOT ' +
          'a goods budget: under a 20% tariff an amount of 9 000 000 buys a ' +
          '7 500 000 basket. Every term comes back at 0 when there is no usable ' +
          'limit; GET /status says why.',
        security: SECURITY,
        response: { 200: LimitResponse, 401: ERROR },
      },
      preHandler: guards,
    },
    async (request) => {
      return loadLimitOffers(Number(request.user.sub));
    },
  );
}
