import { randomUUID } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db as appDb } from '@db';
import { users } from '@db/schema';
import { katm077Reports } from '@db/katm-077-reports';
import { katmInpsReports } from '@db/katm-inps-reports';
import { dealSessions } from '../../deals/schema';
import { loadBlockingDeal } from '../../deals/blocking';
import {
  err as codedErr,
  isSigningProofFresh,
  isWizardStep,
  stepDataOf,
  type DealSessionRow,
  type SessionStepData,
} from './types';
import { createMyidSession, exchangeMyidCode } from '../../integrations/myid/client';
import { env } from '../../../env';
import {
  clearSigningRequest,
  stampMyidSigning,
  stampOtpSigning,
  stampSigningRequest,
} from './commands/stamp-signing/stamp-signing.handler';
import {
  hasPushDevice,
  requireTerms,
  resolveSigningContext,
  sendSigningRequestPush,
} from '../../deals/signing/service';
import { issueSigningOtp, verifySigningOtp } from '../../deals/signing/otp';
import { getActiveSession } from './queries/get-active-session/get-active-session.handler';
import {
  loadOwnedActiveSession,
  loadOwnedSession,
} from './queries/load-owned-active-session/load-owned-active-session.handler';
import { createSession } from './commands/create-session/create-session.handler';
import { abandonSession } from './commands/abandon-session/abandon-session.handler';
import { saveStep } from './commands/save-step/save-step.handler';
import { stampPrepayment } from './commands/stamp-prepayment/stamp-prepayment.handler';
import { setSessionUserId } from './commands/set-session-user-id/set-session-user-id.handler';
import { setFlowMode } from './commands/set-flow-mode/set-flow-mode.handler';
import { loadReusableLimit } from './queries/reusable-limit/reusable-limit.handler';
import { setKatmClaimId } from './commands/set-katm-claim-id/set-katm-claim-id.handler';
import { stampKatmPending } from './commands/stamp-katm-pending/stamp-katm-pending.handler';
import {
  allocateKatmClaimId,
  runScoringPipeline,
  createKatmConsent,
  type PipelineStepResult,
} from '../../integrations/katm/flow';
import { enqueueKatmPoll } from '../../integrations/katm/poller';
import { enqueueClaimRejection } from '../../integrations/katm/claim-reject';
import {
  REJECT_REASON_CATEGORY,
  type ScoringRejectReasonCode,
} from '../../scoring/pipelines/types';
import { stampKatm } from './commands/stamp-katm/stamp-katm.handler';
import {
  startScoringRun,
  setKatmClaimIdOnScoring,
  loadScoringBySession,
  markScored,
  markRejected,
  markError,
  setCurrentPipeline,
  recordPipeline,
} from '../../scoring/pipelines/store';
import { enqueuePlumCardScore } from '../../integrations/plumgate/card-scoring';
import { listCards } from '../../integrations/plumgate/queries/list-cards/list-cards.handler';
import { addCard } from '../../integrations/plumgate/commands/add-card/add-card.handler';
import { confirmCard } from '../../integrations/plumgate/commands/confirm-card/confirm-card.handler';
import { stampScoring } from './commands/stamp-scoring/stamp-scoring.handler';
import { rejectSession } from './commands/reject-session/reject-session.handler';
import type { GENDERS } from '../../integrations/katm/service/shared';
import { resolveScoringModel } from '../../scoring/resolve-model';
import { runModelAndLimit } from '../../scoring/compute-limit';

type JwtPayload = {
  sub: string;
  merchantId: string;
  branchId: string;
  role: string;
};

function payload(request: { user: unknown }) {
  return request.user as JwtPayload;
}

/** The session-loading failures every session-scoped route answers the same way. */
function sessionErrorReply(
  reply: { code: (n: number) => { sendError: (c: string) => unknown } },
  e: any,
) {
  switch (e?.code) {
    case 'session_not_found':
      return reply.code(404).sendError('session_not_found');
    case 'session_not_active':
      return reply.code(409).sendError('session_not_active');
    case 'client_step_missing':
      return reply.code(409).sendError('client_step_missing');
    case 'user_not_found':
      return reply.code(404).sendError('user_not_found');
    default:
      throw e;
  }
}

/**
 * Build the up-front KATM summary the wizard shows, from the persisted 077
 * report. Used on the synchronous gates-passed path where the 077 result is no
 * longer in hand (the chain returns only its next step).
 */
async function load077Summary(claimId: string) {
  const [row] = await appDb
    .select()
    .from(katm077Reports)
    .where(eq(katm077Reports.claimId, claimId))
    .limit(1);
  if (!row) return {};
  return {
    demandId: row.demandId ?? '',
    score: row.score ?? 0,
    scoringClass: row.scoringClass ?? '',
    scoringLevel: row.scoringLevel ?? '',
    activeLoans: row.activeLoans ?? 0,
    allDebtSum: row.allDebtSum ?? 0,
    overdueCount: row.overdueCount ?? 0,
    overdueAmount: row.overdueAmount ?? 0,
    maxOverdueDays: row.maxOverdueDays ?? 0,
    totalContracts: row.totalContracts ?? 0,
    totalClaims: row.totalClaims ?? 0,
    avgMonthlyPayment: row.avgMonthlyPayment ?? 0,
    hasDefaults: row.hasDefaults ?? false,
    hasCreditBan: row.hasCreditBan ?? false,
  };
}

const TAGS = ['Merchant · Deal Sessions'];

export default async function merchantDealSessionRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const db = app.db;

  /* ── DTO ───────────────────────────────────────────────────────────────── */

  // The resume payload: session head + the user row joined in (the head holds
  // only userId — the users row is the PII home, never duplicated in jsonb)
  async function toSessionDto(session: DealSessionRow) {
    let client = null;
    if (session.userId != null) {
      const [c] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
      if (c) {
        client = {
          id: c.id.toString(),
          pinfl: c.pinfl,
          firstName: c.firstName,
          lastName: c.lastName,
          phone: c.phone,
          birthDate: c.birthDate,
          gender: c.gender,
          nationality: c.nationality,
          passportSeries: c.passportSeries,
          passportNumber: c.passportNumber,
        };
      }
    }

    return {
      id: session.id,
      currentStep: session.currentStep,
      status: session.status,
      stepData: session.stepData,
      client,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    };
  }

  const guards = [app.verifyMerchantJwt, app.requirePermission('create_deal')];

  /* ── GET /active — the agent's single active session, or null ─────────── */

  fastify.get('/active', { schema: { tags: TAGS }, preHandler: guards }, async (request) => {
    const p = payload(request);
    const session = await getActiveSession(Number(p.sub));
    return { session: session ? await toSessionDto(session) : null };
  });

  /* ── POST / — open a new Wizard run (auto-supersedes the old one) ──────── */

  fastify.post('/', { schema: { tags: TAGS }, preHandler: guards }, async (request, reply) => {
    const p = payload(request);
    const activeSession = await getActiveSession(Number(p.sub));
    if (activeSession) {
      await abandonSession(activeSession);
      await enqueueClaimRejection(app.katmClaimRejectQueue, activeSession);
    }
    const session = await createSession({
      merchantId: Number(p.merchantId),
      branchId: Number(p.branchId),
      agentId: Number(p.sub),
    });
    return reply.code(201).send({ session: await toSessionDto(session) });
  });

  /* ── PUT /:id/steps/:step — blocking per-step save ─────────────────────── */

  const StepParams = Type.Object({ id: Type.String(), step: Type.String() });
  // Payload shape varies per step; validated field-by-field in the service
  const StepBody = Type.Record(Type.String(), Type.Any());

  fastify.put(
    '/:id/steps/:step',
    { schema: { tags: TAGS, params: StepParams, body: StepBody }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request);
      const { id, step } = request.params;
      if (!isWizardStep(step)) return reply.code(400).sendError('invalid_step');

      try {
        const session = await loadOwnedActiveSession(id, Number(p.sub));
        const updated = await saveStep(session, step, request.body as Record<string, unknown>);
        return { session: await toSessionDto(updated) };
      } catch (err: any) {
        console.error(err);
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found');
        if (err.code === 'session_not_active')
          return reply.code(409).sendError('session_not_active');
        if (err.code === 'invalid_step_payload')
          return reply.code(400).sendError('invalid_step_payload');
        if (err.code === 'reuse_limit_unavailable')
          return reply.code(409).sendError('reuse_limit_unavailable');
        if (err.code === 'client_not_found') return reply.code(400).sendError('client_not_found');
        if (err.code === 'tariff_not_found') return reply.code(400).sendError('tariff_not_found');
        if (err.code === 'product_not_found') return reply.code(400).sendError('product_not_found');
        throw err;
      }
    },
  );

  const IdParams = Type.Object({ id: Type.String() });

  /* ── POST /:id/prepayment/request + confirm — two-step mocked acquiring ── */
  //
  // Phase 1 (request): validate the session gap, store a pending token, return
  // a sessionId + maskedPhone so the frontend can render the OTP phase.
  // Phase 2 (confirm): look up the token by sessionId, stamp prepayment.
  // Both sides are mocked — replace with a real processor when one is chosen.

  const pendingPrepayments = new Map<string, { gap: number }>();

  function maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 7) return phone;
    return `+${digits.slice(0, 3)} ** *** ${digits.slice(-4, -2)} ${digits.slice(-2)}`;
  }

  const PrepayRequestBody = Type.Object({
    cardNumber: Type.String(),
    expiry: Type.String(),
    phone: Type.String(),
  });

  fastify.post(
    '/:id/prepayment/request',
    { schema: { tags: TAGS, params: IdParams, body: PrepayRequestBody }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request);
      let session: DealSessionRow;
      try {
        session = await loadOwnedActiveSession(request.params.id, Number(p.sub));
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found');
        if (err.code === 'session_not_active')
          return reply.code(409).sendError('session_not_active');
        throw err;
      }

      const data = session.stepData as SessionStepData;
      if (!data.products?.lines?.length) return reply.code(409).sendError('products_step_missing');
      if (!data.tariff) return reply.code(409).sendError('tariff_step_missing');
      if (!data.scoring) return reply.code(409).sendError('scoring_missing');

      const basketBase = data.products.lines.reduce(
        (sum, l) => sum + Math.round(parseFloat(l.price) * 100) * l.quantity,
        0,
      );
      const totalWithMarkup = Math.round(basketBase * (1 + data.tariff.markupPercent / 100));
      // platformCreditLimit is whole som; totalWithMarkup is tiyin — ×100 to compare.
      const effectiveLimit =
        Math.round(data.scoring.platformCreditLimit * data.tariff.termMonths) * 100;
      const gap = totalWithMarkup - effectiveLimit;

      if (gap <= 0) return reply.code(409).sendError('no_prepayment_needed');

      const sessionId = randomUUID();
      pendingPrepayments.set(sessionId, { gap });

      return { sessionId, maskedPhone: maskPhone(request.body.phone) };
    },
  );

  const PrepayConfirmBody = Type.Object({
    sessionId: Type.String(),
    otp: Type.String(),
  });

  fastify.post(
    '/:id/prepayment/confirm',
    { schema: { tags: TAGS, params: IdParams, body: PrepayConfirmBody }, preHandler: guards },
    async (request, reply) => {
      const pending = pendingPrepayments.get(request.body.sessionId);
      if (!pending) return reply.code(409).sendError('prepayment_session_not_found');

      let session: DealSessionRow;
      try {
        session = await loadOwnedActiveSession(request.params.id, Number(payload(request).sub));
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found');
        if (err.code === 'session_not_active')
          return reply.code(409).sendError('session_not_active');
        throw err;
      }

      pendingPrepayments.delete(request.body.sessionId);
      await stampPrepayment(session, {
        amount: pending.gap,
        confirmedAt: new Date().toISOString(),
      });

      const [updated] = await db
        .select()
        .from(dealSessions)
        .where(eq(dealSessions.id, session.id))
        .limit(1);

      return { session: await toSessionDto(updated ?? session) };
    },
  );

  /* ── POST /:id/abandon — the wizard's close-deal action ────────────────── */

  fastify.post(
    '/:id/abandon',
    { schema: { tags: TAGS, params: IdParams }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request);
      try {
        const session = await loadOwnedActiveSession(request.params.id, Number(p.sub));
        await abandonSession(session);
        await enqueueClaimRejection(app.katmClaimRejectQueue, session);
        return { ok: true };
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found');
        // Abandoning an already-closed session is a no-op, not an error
        if (err.code === 'session_not_active') return { ok: true };
        throw err;
      }
    },
  );

  /* ── POST /:id/start — kick off KATM scoring for the session ───────────── */

  const StartBody = Type.Object({ userId: Type.String({ minLength: 1 }) });

  fastify.post(
    '/:id/start',
    { schema: { tags: TAGS, params: IdParams, body: StartBody }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request);
      const { userId } = request.body;

      console.log('\n========================================================');
      console.log('[START] POST /:id/start invoked');
      console.log('[START] params.id (sessionId):', request.params.id);
      console.log('[START] body.userId:', userId);
      console.log('[START] jwt payload:', {
        sub: p.sub,
        merchantId: p.merchantId,
        branchId: p.branchId,
        role: p.role,
      });
      console.log('========================================================');

      let session;
      try {
        console.log(
          '[START] → loadOwnedActiveSession(',
          request.params.id,
          ',',
          Number(p.sub),
          ')',
        );
        session = await loadOwnedActiveSession(request.params.id, Number(p.sub));
        console.log('[START] ← session loaded:', {
          id: session.id,
          status: session.status,
          currentStep: session.currentStep,
          userId: session.userId,
          katmClaimId: session.katmClaimId,
        });
      } catch (err: any) {
        console.error(
          '[START] ✖ loadOwnedActiveSession failed. code=',
          err?.code,
          'msg=',
          err?.message,
        );
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found');
        if (err.code === 'session_not_active')
          return reply.code(409).sendError('session_not_active');
        throw err;
      }

      console.log('[START] → fetching user row for userId=', Number(userId));
      const [client] = await db
        .select()
        .from(users)
        .where(eq(users.id, Number(userId)))
        .limit(1);

      if (!client) {
        console.error('[START] ✖ user_not_found for userId=', userId);
        return reply.code(404).sendError('user_not_found');
      }
      console.log('[START] ← client row:', {
        id: client.id,
        pinfl: client.pinfl,
        passportSeries: client.passportSeries,
        passportNumber: client.passportNumber,
        docType: client.docType,
        regionCode: client.regionCode,
        districtCode: client.districtCode,
        address: client.address,
        phone: client.phone,
        birthDate: client.birthDate,
        gender: client.gender,
        citizenShipId: client.citizenShipId,
      });

      console.log('[START] → setSessionUserId(session,', client.id, ')');
      await setSessionUserId(session, client.id);

      // ── Reuse path (ADR — reuse scoring) ────────────────────────────────────
      // A returning client who already self-scored on mobile and still holds an
      // unexpired, positive limit skips MyID + KATM + the model entirely. We
      // route the wizard through the contacts step (flowMode='reuse'); the
      // contacts step rehydrates the scoring stamp from that run. No KATM charge.
      const reusable = await loadReusableLimit(client.id);
      if (reusable) {
        console.log(
          '[START] reusable limit found — creditLimit=',
          reusable.creditLimit,
          'expiresAt=',
          reusable.expiresAt.toISOString(),
        );
        await setFlowMode(session, 'reuse');
        console.log('[START] ✓ responding status=cached');
        return {
          status: 'cached' as const,
          creditLimit: reusable.creditLimit,
          expiresAt: reusable.expiresAt.toISOString(),
        };
      }
      // No reusable limit — full scoring. Clear any stale 'reuse' from a prior
      // client selection on this session so advancement uses the full sequence.
      // (Absent flowMode already means 'full'; the later KATM stamps re-derive
      // stepData from the DB row, so no local reassignment is needed here.)
      await setFlowMode(session, 'full');

      console.log(
        '[START] → createKatmConsent({ userId:',
        client.id,
        ', sessionId:',
        session.id,
        '})',
      );
      const consent = await createKatmConsent({
        userId: client.id,
        sessionId: session.id,
      });
      console.log('[START] ← consent:', {
        agreementId: consent.agreementId,
        agreementDate: consent.agreementDate,
      });

      const claimId = session.katmClaimId ?? (await allocateKatmClaimId());
      if (!session.katmClaimId) {
        console.log('[START] no existing katmClaimId — allocated new claimId=', claimId);
        await setKatmClaimId(session, claimId);
        session = { ...session, katmClaimId: claimId };
      } else {
        console.log('[START] reusing existing katmClaimId=', claimId);
      }

      // Open (or reset) the scoring run for this session and pin its KATM claim.
      console.log('[START] → startScoringRun(', session.id, ',', client.id, ')');
      const scoring = await startScoringRun(session.id, client.id);
      console.log('[START] ← scoring run id=', scoring.id);
      console.log('[START] → setKatmClaimIdOnScoring(', scoring.id, ',', claimId, ')');
      await setKatmClaimIdOnScoring(scoring.id, claimId);

      const consentDate = consent.agreementDate.toISOString();

      // The pipeline chain (myid → katm_claim → 077 → INPS) drives the scoring
      // run. It returns what the caller must do next; the poll worker handles
      // the same PipelineStepResult when a report resolves asynchronously.
      // myid and katm_claim knockouts (incl. OneID-locked) come back as
      // kind:'rejected' — they are recorded scoring rejections, not throws.
      console.log('[START] → runScoringPipeline(...) scoringId=', scoring.id, 'claimId=', claimId);
      const step: PipelineStepResult = await runScoringPipeline({
        scoringId: scoring.id,
        claimId,
        consent,
        subject: {
          pinfl: client.pinfl,
          passportSerial: client.passportSeries!,
          passportNumber: client.passportNumber!,
          docType: client.docType!,
          regionCode: client.regionCode!,
          districtCode: client.districtCode!,
          address: client.address!,
          phone: client.phone,
          birthDate: client.birthDate,
          gender: client.gender as GENDERS,
          citizenShipId: client.citizenShipId ?? '',
        },
        userId: client.id,
        sessionId: session.id,
      });
      console.log('[START] ← runScoringPipeline returned step:', JSON.stringify(step));

      // A chargeable report went async — mark the wizard pending and enqueue the
      // follow-up poll, which will resume the chain when the report resolves.
      if (step.kind === 'enqueue_poll') {
        console.log(
          '[START] step.kind=enqueue_poll → marking pending + enqueue poll. reportType=',
          step.reportType,
        );
        await stampKatmPending(session, {
          status: 'pending',
          startedAt: new Date().toISOString(),
        });
        await enqueueKatmPoll(app.katmPollQueue, {
          sessionId: session.id,
          claimId,
          consentId: consent.agreementId,
          consentDate,
          token: step.token,
          reportType: step.reportType,
        });
        console.log('[START] ✓ responding status=pending');
        return { status: 'pending' as const };
      }

      // A stop-factor knocked the client out (scorings already marked rejected).
      // myid / katm_claim / 077 / inps knockouts all arrive here uniformly. A
      // rejection is a scoring OUTCOME, not a transport error: return 200 with
      // the specific reasonCode + category so the client can show why and which
      // fields (if any) to fix. Mirrors /cards/score's 200 reject responses.
      if (step.kind === 'rejected') {
        console.log(
          '[START] step.kind=rejected → reasonCode=',
          step.reasonCode,
          'missingFields=',
          step.missingFields,
        );
        await stampKatmPending(session, {
          status: 'failed',
          startedAt: new Date().toISOString(),
          error: step.reasonCode,
        });
        await rejectSession(session);
        await enqueueClaimRejection(app.katmClaimRejectQueue, session);
        console.log('[START] ✓ responding status=rejected reasonCode=', step.reasonCode);
        return {
          status: 'rejected' as const,
          reasonCode: step.reasonCode,
          reasonCategory: REJECT_REASON_CATEGORY[step.reasonCode],
          ...(step.missingFields ? { missingFields: step.missingFields } : {}),
        };
      }

      // A technical / needs-review failure (e.g. an unmapped MIB code). Not a
      // business reject: fail the KATM step but leave the session open so the run
      // can be retried once the integration gap is resolved.
      if (step.kind === 'failed') {
        console.log('[START] step.kind=failed → reason=', step.reason);
        await stampKatmPending(session, {
          status: 'failed',
          startedAt: new Date().toISOString(),
          error: step.reason,
        });
        console.log('[START] ✓ responding status=failed reason=', step.reason);
        return { status: 'failed' as const, reason: step.reason };
      }

      // gates_passed — every KATM gate cleared synchronously. Advance the wizard
      // and hand the 077 summary back to the client.
      console.log('[START] step.kind=gates_passed → stampKatm + load077Summary');
      await stampKatm(session);
      const summary = await load077Summary(claimId);
      console.log('[START] ✓ responding status=completed summary=', JSON.stringify(summary));
      return { status: 'completed' as const, ...summary };
    },
  );

  /* ── Верификация — MyID (identity) first, then OTP (акцепт) ──────────────── */
  //
  // Both proofs are stamped onto the session server-side (stepData.signing); the
  // browser carries no token between them, and POST /merchant/deals will not build
  // a Deal without both, fresh. The order is enforced HERE, not by the UI: the OTP
  // endpoints refuse until the face-scan has landed.

  /**
   * Load the session's client — the ONLY source of the PINFL that must pass the
   * face-scan. Accepting it from the request body (as the old /merchant/client
   * signing endpoints did) proves nothing: the callback would then compare MyID's
   * PINFL against the very PINFL the caller chose.
   */
  async function loadSigningClient(sessionId: string, agentId: number) {
    const session = await loadOwnedActiveSession(sessionId, agentId);
    if (session.userId == null) throw codedErr('client_step_missing');

    const [user] = await db
      .select({ phone: users.phone, pinfl: users.pinfl })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1);
    if (!user) throw codedErr('user_not_found');

    return { session, user };
  }

  /* ── POST /:id/myid-sign — open the signing face-scan for the client ────── */

  fastify.post(
    '/:id/myid-sign',
    { schema: { tags: TAGS, params: IdParams }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request);
      let ctx: Awaited<ReturnType<typeof loadSigningClient>>;
      try {
        ctx = await loadSigningClient(request.params.id, Number(p.sub));
      } catch (err: any) {
        return sessionErrorReply(reply, err);
      }

      // The client can have taken a deal at another merchant since this wizard
      // opened — /start's gate is minutes or hours stale by now. This is the last
      // free moment: past here the face scan and the OTP cost money and put the
      // client's phone in their hand, all for a deal createDeal would refuse.
      if (await loadBlockingDeal(ctx.session.userId!)) {
        return reply.code(409).sendError('active_deal_exists');
      }

      const redirectUri = encodeURIComponent(
        env.MERCHANT_PORTAL_URL + '/myid/callback/signing_deal',
      );
      const myid = await createMyidSession(ctx.user.pinfl, request.ip, redirectUri);

      // Correlates the callback with the session we opened. The PINFL rides along
      // so the callback can reject a scan by anyone else, even before it reaches
      // the (authoritative) comparison against the session's client.
      const signingSessionToken = app.jwt.sign(
        { pinfl: ctx.user.pinfl, myidSessionId: myid.sessionId, purpose: 'deal_signing' },
        { expiresIn: '15m' },
      );

      return { signingSessionToken, redirectUrl: myid.redirectUrl };
    },
  );

  /* ── POST /:id/myid-sign/complete — the callback: verify + stamp ────────── */

  const MyidSignCompleteBody = Type.Object({
    signingSessionToken: Type.String({ minLength: 1 }),
    myidCode: Type.String({ minLength: 1 }),
  });

  fastify.post(
    '/:id/myid-sign/complete',
    { schema: { tags: TAGS, params: IdParams, body: MyidSignCompleteBody }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request);
      let ctx: Awaited<ReturnType<typeof loadSigningClient>>;
      try {
        ctx = await loadSigningClient(request.params.id, Number(p.sub));
      } catch (err: any) {
        return sessionErrorReply(reply, err);
      }

      let signingSession: { pinfl: string; purpose: string };
      try {
        signingSession = app.jwt.verify<{ pinfl: string; purpose: string }>(
          request.body.signingSessionToken,
        );
      } catch {
        return reply.code(400).sendError('invalid_signing_session');
      }
      if (signingSession.purpose !== 'deal_signing') {
        return reply.code(400).sendError('invalid_signing_purpose');
      }

      const myidUser = await exchangeMyidCode(request.body.myidCode);

      // The face that scanned must be THIS session's client. Checking against the
      // token alone would only prove the caller is consistent with themselves.
      if (myidUser.pinfl !== ctx.user.pinfl || myidUser.pinfl !== signingSession.pinfl) {
        return reply.code(400).sendError('pinfl_mismatch');
      }

      const signing = await stampMyidSigning(ctx.session, ctx.user.pinfl);
      return { verified: true, signing };
    },
  );

  /* ── POST /:id/sign-otp — send the акцепт code to the session's client ──── */

  const isProd = app.hasDecorator('isProd')
    ? (app as any).isProd
    : process.env['NODE_ENV'] === 'production';

  fastify.post(
    '/:id/sign-otp',
    {
      config: { rateLimit: { max: 3, timeWindow: 60 * 1000 } },
      schema: { tags: TAGS, params: IdParams },
      preHandler: guards,
    },
    async (request, reply) => {
      const p = payload(request);
      let ctx: Awaited<ReturnType<typeof loadSigningClient>>;
      try {
        ctx = await loadSigningClient(request.params.id, Number(p.sub));
      } catch (err: any) {
        return sessionErrorReply(reply, err);
      }

      const signing = stepDataOf(ctx.session).signing;
      if (!isSigningProofFresh(signing?.myidVerifiedAt)) {
        return reply.code(409).sendError('myid_not_verified');
      }

      // issueSigningOtp now owns the cooldown, the per-run send cap, and — the part
      // this route never did at all — actually SENDING the SMS. It used to mint a
      // code and return it as devOtp, which prod withholds: the акцепт code was
      // being issued to nobody and signing could not complete in production.
      const res = await issueSigningOtp(ctx.user.phone, ctx.session.id);
      if (res.error === 'cooldown') {
        return reply.code(429).sendError('otp_cooldown', { seconds: res.seconds });
      }
      if (res.error === 'send_cap') return reply.code(429).sendError('otp_send_cap');

      if (!isProd)
        request.log.info({ phone: ctx.user.phone, code: res.code }, 'deal_signing OTP issued');

      return { ok: true, ...(isProd ? {} : { devOtp: res.code }) };
    },
  );

  /* ── POST /:id/sign-otp/verify — stamp the client's consent ─────────────── */

  const SignOtpVerifyBody = Type.Object({ code: Type.String({ minLength: 1 }) });

  fastify.post(
    '/:id/sign-otp/verify',
    {
      config: { rateLimit: { max: 10, timeWindow: 60 * 1000 } },
      schema: { tags: TAGS, params: IdParams, body: SignOtpVerifyBody },
      preHandler: guards,
    },
    async (request, reply) => {
      const p = payload(request);
      let ctx: Awaited<ReturnType<typeof loadSigningClient>>;
      try {
        ctx = await loadSigningClient(request.params.id, Number(p.sub));
      } catch (err: any) {
        return sessionErrorReply(reply, err);
      }

      const signing = stepDataOf(ctx.session).signing;
      if (!isSigningProofFresh(signing?.myidVerifiedAt)) {
        return reply.code(409).sendError('myid_not_verified');
      }

      // A guess budget, bounded to the code it guards and burning that code when
      // spent. A 4-digit акцепт with unlimited resends and no attempt counter was
      // forgeable by the one party who holds both the session and the motive.
      const result = await verifySigningOtp(ctx.user.phone, request.body.code);
      if (result === 'attempts_exceeded') {
        return reply.code(429).sendError('otp_attempts_exceeded');
      }
      if (result === 'invalid') return reply.code(400).sendError('invalid_otp');

      // Consent is a stamp, not a token the browser carries: POST /merchant/deals
      // reads it back off the session. A failed deal creation can therefore be
      // retried without burning a second SMS.
      return { ok: true, signing: await stampOtpSigning(ctx.session, 'counter') };
    },
  );

  /* ── Remote signing — hand the gate to the client's own phone ────────────── */
  //
  // Same two proofs, same session, different surface. The Agent stays the one who
  // creates the Deal: its failures (a product deactivated, a tariff bound moved) are
  // fixable only at the counter, and surfacing them on a phone in someone's pocket
  // would strand the client's акцепт with nobody able to act.

  /* ── POST /:id/signing-request — ask the client to sign on their phone ───── */

  fastify.post(
    '/:id/signing-request',
    {
      config: { rateLimit: { max: 5, timeWindow: 60 * 1000 } },
      schema: { tags: TAGS, params: IdParams },
      preHandler: guards,
    },
    async (request, reply) => {
      const p = payload(request);
      let base: Awaited<ReturnType<typeof loadSigningClient>>;
      try {
        base = await loadSigningClient(request.params.id, Number(p.sub));
      } catch (err: any) {
        return sessionErrorReply(reply, err);
      }

      // Same last-free-moment gate the counter flow takes before the face-scan.
      if (await loadBlockingDeal(base.session.userId!)) {
        return reply.code(409).sendError('active_deal_exists');
      }

      // Reachability, not provenance. The natural-sounding gate — "did this client
      // get their limit on mobile?" — is the wrong one: it says how they were
      // SCORED, not whether we can reach their phone now. A client who self-scored
      // and then uninstalled the app would pass it and never see the request; a
      // client who registered at the counter and later installed the app would fail
      // it for no reason.
      if (!(await hasPushDevice(base.session.userId!))) {
        return reply.code(409).sendError('no_signing_device');
      }

      const ctx = await resolveSigningContext(base.session, {
        id: base.session.userId!,
        pinfl: base.user.pinfl,
        phone: base.user.phone,
      });

      let terms;
      try {
        terms = requireTerms(ctx.session);
      } catch {
        return reply.code(409).sendError('session_incomplete');
      }

      const signingRequest = await stampSigningRequest(ctx.session);
      await sendSigningRequestPush(ctx, signingRequest, terms);

      return { ok: true, signingRequest };
    },
  );

  /* ── DELETE /:id/signing-request — take the client back to the counter ───── */

  fastify.delete(
    '/:id/signing-request',
    { schema: { tags: TAGS, params: IdParams }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request);
      let ctx: Awaited<ReturnType<typeof loadSigningClient>>;
      try {
        ctx = await loadSigningClient(request.params.id, Number(p.sub));
      } catch (err: any) {
        return sessionErrorReply(reply, err);
      }

      // Proofs already earned on the phone are KEPT — they are the same two proofs,
      // on the same run. Falling back costs nothing and loses nothing, which is the
      // quiet payoff of signing the SESSION rather than a Deal.
      await clearSigningRequest(ctx.session);
      return { ok: true };
    },
  );

  /* ── GET /:id/signing-status — the wizard polls this while it waits ──────── */

  fastify.get(
    '/:id/signing-status',
    { schema: { tags: TAGS, params: IdParams }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request);
      let session: DealSessionRow;
      try {
        session = await loadOwnedActiveSession(request.params.id, Number(p.sub));
      } catch (err: any) {
        return sessionErrorReply(reply, err);
      }

      const data = stepDataOf(session);
      return {
        signing: data.signing ?? null,
        signingRequest: data.signingRequest ?? null,
        myidVerified: isSigningProofFresh(data.signing?.myidVerifiedAt),
        otpVerified: isSigningProofFresh(data.signing?.otpVerifiedAt),
        // Whether remote signing is even on the table. Sent up-front so the wizard
        // can offer it or not, rather than showing a button that 409s — the client
        // who uninstalled the app is exactly the one the Agent must not be surprised
        // by, with the customer standing in front of them.
        remoteAvailable: session.userId != null ? await hasPushDevice(session.userId) : false,
      };
    },
  );

  /* ── GET /:id/status — poll KATM result stamped on the session ─────── */

  fastify.get(
    '/:id/status',
    { schema: { tags: TAGS, params: IdParams }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request);
      let session;
      try {
        // No active guard: a knockout (e.g. no_income) rejects the session, but
        // the wizard is still polling and must receive the stamped failure
        // rather than a 409 that the client would treat as transient.
        session = await loadOwnedSession(request.params.id, Number(p.sub));
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found');
        throw err;
      }

      if (session.katmClaimId) {
        const [report077, reportInps] = await Promise.all([
          db
            .select()
            .from(katm077Reports)
            .where(eq(katm077Reports.claimId, session.katmClaimId))
            .limit(1),
          db
            .select({ status: katmInpsReports.status })
            .from(katmInpsReports)
            .where(eq(katmInpsReports.claimId, session.katmClaimId))
            .limit(1),
        ]);

        const data = (session.stepData ?? {}) as SessionStepData;
        if (data.katmPending) {
          const error = data.katmPending.error ?? null;
          return {
            status: data.katmPending.status,
            error,
            reasonCategory: error
              ? (REJECT_REASON_CATEGORY[error as ScoringRejectReasonCode] ?? null)
              : null,
          };
        }

        if (report077[0]?.status === 'completed' && reportInps[0]?.status === 'completed') {
          const {
            claimId: _c,
            token: _t,
            raw: _r,
            createdAt: _ca,
            updatedAt: _ua,
            status: _s,
            ...summary
          } = report077[0];
          return { status: 'completed' as const, ...summary };
        }

        return { status: 'none' as const };
      }
    },
  );

  /* ── GET /:id/cards — list cards for the session's user ────────────────── */

  fastify.get(
    '/:id/cards',
    { schema: { tags: TAGS, params: IdParams }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request);
      let session;
      try {
        session = await loadOwnedActiveSession(request.params.id, Number(p.sub));
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found');
        if (err.code === 'session_not_active')
          return reply.code(409).sendError('session_not_active');
        throw err;
      }

      if (session.userId == null) return reply.code(409).sendError('client_step_missing');

      const [user] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
      if (!user) return reply.code(404).sendError('user_not_found');

      // A Plumgate outage must not block the wizard: the merchant can still add a
      // card, which is the only action this list gates. Degrade to an empty list.
      let cards: Awaited<ReturnType<typeof listCards>> = [];
      try {
        cards = await listCards(String(session.userId));
      } catch (err) {
        request.log.warn({ err, userId: session.userId }, 'listCards failed, returning empty list');
      }
      return { cards };
    },
  );

  /* ── POST /:id/cards/add — initiate card addition OTP flow ─────────────── */

  const AddCardBody = Type.Object({
    cardNumber: Type.String({ minLength: 16, maxLength: 19 }),
    expiry: Type.String({ minLength: 4, maxLength: 5 }),
  });

  fastify.post(
    '/:id/cards/add',
    { schema: { tags: TAGS, params: IdParams, body: AddCardBody }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request);
      let session;
      try {
        session = await loadOwnedActiveSession(request.params.id, Number(p.sub));
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found');
        if (err.code === 'session_not_active')
          return reply.code(409).sendError('session_not_active');
        throw err;
      }

      if (session.userId == null) return reply.code(409).sendError('client_step_missing');

      const [user] = await db
        .select({ id: users.id, phone: users.phone })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);
      if (!user) return reply.code(404).sendError('user_not_found');

      const { cardNumber, expiry } = request.body;
      const result = await addCard({
        userId: String(user.id),
        phone: user.phone,
        cardNumber,
        expiry,
      });
      return result;
    },
  );

  /* ── POST /:id/cards/confirm — confirm OTP and complete card addition ───── */

  const ConfirmCardBody = Type.Object({
    sessionId: Type.String({ minLength: 1 }),
    otp: Type.String({ minLength: 4, maxLength: 8 }),
  });

  fastify.post(
    '/:id/cards/confirm',
    { schema: { tags: TAGS, params: IdParams, body: ConfirmCardBody }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request);
      try {
        await loadOwnedActiveSession(request.params.id, Number(p.sub));
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found');
        if (err.code === 'session_not_active')
          return reply.code(409).sendError('session_not_active');
        throw err;
      }

      const { sessionId, otp } = request.body;
      const card = await confirmCard({ sessionId, otp });
      return { card };
    },
  );

  /* ── POST /:id/cards/score — score a card and stamp result onto session ── */

  const BailsmanItemSchema = Type.Object({
    relation: Type.Union([
      Type.Literal('father'),
      Type.Literal('mother'),
      Type.Literal('brother'),
      Type.Literal('friend'),
      Type.Literal('other'),
    ]),
    phone: Type.String({ minLength: 1 }),
  });

  const ScoreCardBody = Type.Object({
    plumCardId: Type.String({ minLength: 1 }),
    pcType: Type.Union([Type.Literal('uzcard'), Type.Literal('humo')]),
    maskedPan: Type.String({ minLength: 1 }),
    bank: Type.String({ minLength: 1 }),
    holderName: Type.String(),
    expiry: Type.String({ minLength: 1 }),
    bailsmen: Type.Optional(Type.Array(BailsmanItemSchema, { minItems: 1, maxItems: 5 })),
  });

  fastify.post(
    '/:id/cards/score',
    { schema: { tags: TAGS, params: IdParams, body: ScoreCardBody }, preHandler: guards },
    async (request, reply) => {
      const p = payload(request);
      const { plumCardId, pcType, maskedPan, bank, holderName, expiry } = request.body;

      let session;
      try {
        session = await loadOwnedActiveSession(request.params.id, Number(p.sub));
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found');
        if (err.code === 'session_not_active')
          return reply.code(409).sendError('session_not_active');
        throw err;
      }

      if (session.userId == null) return reply.code(409).sendError('client_step_missing');

      // The scoring run opened at /start — used to record the model_score stage
      // and transition the run to its terminal state. Null only if /start was
      // never reached for this session.
      const scoringRun = await loadScoringBySession(session.id);

      let katm: typeof katm077Reports.$inferSelect | null = null;
      let inps: typeof katmInpsReports.$inferSelect | null = null;
      if (session.katmClaimId) {
        const [report, inpsReport] = await Promise.all([
          db
            .select()
            .from(katm077Reports)
            .where(eq(katm077Reports.claimId, session.katmClaimId))
            .limit(1),
          db
            .select()
            .from(katmInpsReports)
            .where(eq(katmInpsReports.claimId, session.katmClaimId))
            .limit(1),
        ]);
        if (report[0]?.demandId != null) katm = report[0];
        if (inpsReport[0]?.demandId != null) inps = inpsReport[0];
      }

      // Pre-engine hard gate: credit ban is a regulatory constraint, not a scoring criterion
      if (katm?.hasCreditBan === true) {
        const sessionAfterCard = await saveStep(session, 'card', {
          cardId: plumCardId,
          maskedPan,
          pcType,
          bank,
          holderName,
          expiry,
        });
        await stampScoring(sessionAfterCard, {
          cardId: plumCardId,
          scoringId: null,
          scoreSum: 0,
          coefficient: 0,
          decision: 'reject',
          platformCreditLimit: 0,
          criteriaScores: {},
        });
        await rejectSession(sessionAfterCard);
        await enqueueClaimRejection(app.katmClaimRejectQueue, sessionAfterCard);
        return {
          score: 0,
          limit: 0,
          decision: 'reject',
          scoringId: null,
          coefficient: 0,
          criteriaScores: {},
          sessionClosed: true,
        };
      }

      if (scoringRun) await setCurrentPipeline(scoringRun.id, 'model_score');

      const resolvedModel = await resolveScoringModel(db, Number(p.merchantId));
      if (!resolvedModel) {
        if (scoringRun) {
          await recordPipeline(scoringRun.id, 'model_score', { status: 'error' });
          await markError(scoringRun.id);
        }
        throw new Error('no_scoring_model_available');
      }

      const [userRow] = await db
        .select({
          birthDate: users.birthDate,
          gender: users.gender,
          nationality: users.nationality,
          citizenship: users.citizenShipId,
          region: users.regionCode,
          address: users.address,
        })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1);

      // Single source of truth for the model run + limit formula + criteria
      // breakdown — shared with the client self-scoring path (compute-limit.ts).
      const {
        scoreSum,
        coefficient,
        decision: finalDecision,
        platformCreditLimit,
        criteriaScores,
        engineRejected,
        engineResult,
      } = runModelAndLimit({
        model: resolvedModel.params,
        userRow: userRow ?? null,
        katm,
        inps,
        card: { pcType, bank, maskedPan, holderName },
      });

      // model_score is a pure execution marker: the row is 'passed' whenever the
      // model ran (approve, zero-limit, or stop-factor alike). The approve/reject
      // decision lives on the scorings rollup, not on this pipeline row.
      if (scoringRun) {
        await recordPipeline(scoringRun.id, 'model_score', {
          status: 'passed',
          summary: { score: scoreSum, platformCreditLimit },
          raw: engineResult,
        });
        if (finalDecision === 'approve') {
          await markScored(scoringRun.id, {
            score: scoreSum,
            creditLimit: String(platformCreditLimit),
            criteriaScores,
          });
        } else {
          await markRejected(scoringRun.id, engineRejected ? 'model_stop_factor' : 'zero_limit');
        }
      }

      // Scoring history persistence removed — to be rebuilt from scratch.
      // The computed result is still stamped onto the session below.
      const scoringId: string | null = null;

      const sessionAfterCard = await saveStep(session, 'card', {
        cardId: plumCardId,
        maskedPan,
        pcType,
        bank,
        holderName,
        expiry,
      });

      await stampScoring(
        sessionAfterCard,
        {
          cardId: plumCardId,
          scoringId,
          scoreSum,
          coefficient,
          decision: finalDecision,
          platformCreditLimit,
          criteriaScores: criteriaScores as Record<string, unknown>,
        },
        request.body.bailsmen,
      );

      if (finalDecision === 'reject') {
        await rejectSession(sessionAfterCard);
        await enqueueClaimRejection(app.katmClaimRejectQueue, sessionAfterCard);
      }

      // plum_card — observational card-behaviour scoring (does NOT feed the model).
      // Fired for rejected runs too: a dataset truncated at the current model's
      // decision boundary has no negative samples and cannot be used to fit its
      // successor. Async, so the agent's wizard never waits on Plumgate.
      if (scoringRun) {
        await enqueuePlumCardScore({
          scoringId: scoringRun.id,
          plumCardId,
          pcType,
          maskedPan,
        });
      }

      return {
        scoringId,
        coefficient,
        scoreSum,
        criteriaScores,
        limit: platformCreditLimit,
        sessionClosed: finalDecision === 'reject',
      };
    },
  );
}
