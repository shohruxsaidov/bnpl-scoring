import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '@db/deal-sessions';
import { loadBlockingDeal } from '../../deals/blocking';
import {
  buildSigningRequestDto,
  loadSigningContext,
  requireTerms,
  type SigningContext,
} from '../../deals/signing/service';
import { issueSigningOtp, verifySigningOtp } from '../../deals/signing/otp';
import { buildDealTerms } from '../../deals/signing/terms';
import {
  rejectSigningRequest,
  stampMyidSigning,
  stampOtpSigning,
} from '../../merchant/deal-sessions/commands/stamp-signing/stamp-signing.handler';
import { isSigningProofFresh, stepDataOf } from '../../merchant/deal-sessions/types';
import {
  createMobileMyidSession,
  exchangeMobileMyidCode,
} from '../../integrations/myid/myid-mobile-new-flow';
import {
  autoCreateDealAfterSigning,
  loadDealForSession,
} from '../../merchant/deals/commands/create-deal/auto-create.handler';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Client Deal Signing — the client signs on their OWN phone.
//
// A merchant Agent, with the client standing at the counter, asks them to sign
// there rather than on the Agent's tablet: the client already has the app (it is
// how they got their limit), so the face-scan happens through the MyID SDK they
// have already used, and the акцепт code lands on the phone that is in their hand.
//
// What is being signed is a DEAL SESSION. The client's two proofs are stamped onto
// that session, and the акцепт is the last DECISION anyone makes about this deal —
// so the server builds the Deal itself the moment consent lands, rather than waiting
// for the agent to press a button that asks them nothing.
//
// That does not move the FAILURES onto the phone, and the distinction is the whole
// design of this file. Deal creation can fail for reasons only an agent can fix (a
// product went inactive, a tariff bound moved) and the client, whose phone is back
// in their pocket, can act on none of them. So the outcome the client is told is a
// boolean — signed, and either it went through or the seller is finishing it — while
// the reason is parked on the run for the agent's screen. See auto-create.handler.
//
// The push is a NUDGE. GET /to-sign is the truth: the app finds pending requests by
// asking, so a dropped notification costs seconds, not the deal.
// ---------------------------------------------------------------------------

const ERROR = { $ref: 'ErrorResponse#' };
const SECURITY = [{ clientAuth: [] }];

/** Every failure to find a signable run answers identically — see loadSigningContext. */
function signingErrorReply(reply: any, e: any) {
  switch (e?.code) {
    case 'signing_request_not_found':
      return reply.code(404).sendError('signing_request_not_found');
    case 'session_incomplete':
      return reply.code(409).sendError('session_incomplete');
    default:
      throw e;
  }
}

export default async function clientDealSigningRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Client · Deal Signing'];
  const guards = [app.verifyClientJwt];

  const IdParams = Type.Object({ id: Type.String() });

  const isProd = app.hasDecorator('isProd')
    ? (app as any).isProd
    : process.env['NODE_ENV'] === 'production';

  /* ── GET /to-sign — what a merchant is asking me to sign, right now ─────── */

  const BasketLine = Type.Object({
    productName: Type.String(),
    quantity: Type.Integer(),
    total: Type.Number(),
  });

  const ScheduleRow = Type.Object({
    index: Type.Integer(),
    dueDate: Type.String(),
    amount: Type.Number(),
  });

  const SigningRequest = Type.Object({
    dealSessionId: Type.String(),
    merchantName: Type.String(),
    branchName: Type.String(),
    requestedAt: Type.String(),
    terms: Type.Object({
      tariffName: Type.String(),
      termMonths: Type.Integer(),
      markupPercent: Type.Number(),
      paymentDay: Type.Integer(),
      lang: Type.String(),
      amount: Type.Number(),
      totalPayable: Type.Number(),
      prepaymentAmount: Type.Number(),
      monthlyPayment: Type.Number(),
      basket: Type.Array(BasketLine),
    }),
    schedule: Type.Array(ScheduleRow),
    signing: Type.Object({
      myidVerified: Type.Boolean(),
      otpVerified: Type.Boolean(),
    }),
  });

  fastify.get(
    '/to-sign',
    {
      schema: {
        tags: TAGS,
        summary: 'Deals awaiting my signature',
        description:
          'Signing requests a merchant has sent to this client. A list, not a single item: ' +
          'sessions are one-per-AGENT, so two different merchants can be asking at once and ' +
          'the client must be able to tell which is which. This endpoint — not the push — is ' +
          'the source of truth; the app polls it on foreground and never needs a notification.',
        security: SECURITY,
        response: { 200: Type.Object({ requests: Type.Array(SigningRequest) }), 401: ERROR },
      },
      preHandler: guards,
    },
    async (request) => {
      const userId = Number(request.user.sub);

      const rows = await db
        .select({ id: dealSessions.id })
        .from(dealSessions)
        .where(and(eq(dealSessions.userId, userId), eq(dealSessions.status, 'active')));

      const requests = [];
      for (const { id } of rows) {
        let ctx: SigningContext;
        try {
          ctx = await loadSigningContext(id, userId);
        } catch {
          continue; // not asked to sign this one — it's just the agent's open wizard
        }
        // A run whose terms are incomplete is not offerable; the Agent is still
        // typing. Skipped rather than errored — this is a list, not a lookup.
        const terms = buildDealTerms(stepDataOf(ctx.session));
        if (!terms) continue;
        requests.push(buildSigningRequestDto(ctx, terms));
      }

      return { requests };
    },
  );

  /* ── POST /:id/reject — «это не моё» / «условия не подходят» ──── */

  fastify.post(
    '/:id/reject',
    {
      schema: {
        tags: TAGS,
        summary: 'Decline a signing request',
        description:
          'Recoverable by design. This cancels the SIGNING REQUEST, not the wizard run: the ' +
          'commonest reason to decline is "the monthly payment is too high", and the Agent ' +
          'should be able to drop the tariff and ask again in ten seconds — not rebuild the ' +
          'deal and pay the credit bureau for a second claim. The rejection is recorded, so a ' +
          'run refused three times before it was accepted does not read as one accepted first time.',
        security: SECURITY,
        params: IdParams,
        response: { 200: Type.Object({ ok: Type.Boolean() }), 401: ERROR, 404: ERROR },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      let ctx: SigningContext;
      try {
        ctx = await loadSigningContext(request.params.id, Number(request.user.sub));
      } catch (e: any) {
        return signingErrorReply(reply, e);
      }

      await rejectSigningRequest(ctx.session);
      return { ok: true };
    },
  );

  /* ── POST /:id/sign/myid-session — open the face-scan ─────────── */

  fastify.post(
    '/:id/sign/myid-session',
    {
      config: { rateLimit: { max: 5, timeWindow: 60 * 1000 } },
      schema: {
        tags: TAGS,
        summary: 'Open the MyID face-scan for signing',
        description:
          'Returns a MyID session id for the native SDK to drive. Note this is the MOBILE MyID ' +
          'flow — there is no redirect URL, unlike the merchant browser flow.',
        security: SECURITY,
        params: IdParams,
        response: {
          200: Type.Object({ sessionId: Type.String() }),
          401: ERROR,
          404: ERROR,
          409: ERROR,
        },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      let ctx: SigningContext;
      try {
        ctx = await loadSigningContext(request.params.id, Number(request.user.sub));
      } catch (e: any) {
        return signingErrorReply(reply, e);
      }

      // The client may have taken a deal at another merchant since this wizard
      // opened. This is the last free moment: past here the scan costs money and
      // the SMS costs money, all for a Deal createDeal would refuse anyway.
      if (await loadBlockingDeal(ctx.user.id)) {
        return reply.code(409).sendError('active_deal_exists');
      }

      // Terms must be complete before a proof can be spent on them — otherwise the
      // client scans their face for a basket the Agent has not finished.
      requireTerms(ctx.session);

      const myid = await createMobileMyidSession(ctx.user.pinfl);
      return { sessionId: myid.sessionId };
    },
  );

  /* ── POST /:id/sign/myid-complete — verify + stamp identity ───── */

  const MyidCompleteBody = Type.Object({ code: Type.String({ minLength: 1 }) });

  fastify.post(
    '/:id/sign/myid-complete',
    {
      schema: {
        tags: TAGS,
        summary: 'Complete the MyID face-scan',
        security: SECURITY,
        params: IdParams,
        body: MyidCompleteBody,
        response: {
          200: Type.Object({ verified: Type.Boolean() }),
          400: ERROR,
          401: ERROR,
          404: ERROR,
        },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      let ctx: SigningContext;
      try {
        ctx = await loadSigningContext(request.params.id, Number(request.user.sub));
      } catch (e: any) {
        return signingErrorReply(reply, e);
      }

      const myidUser = await exchangeMobileMyidCode(request.body.code);

      // The face that scanned must be the session's client — who is also the
      // authenticated caller, since loadSigningContext already tied the session's
      // userId to the JWT. One comparison, both guarantees.
      if (myidUser.pinfl !== ctx.user.pinfl) {
        return reply.code(400).sendError('pinfl_mismatch');
      }

      await stampMyidSigning(ctx.session, ctx.user.pinfl, 'remote');
      return { verified: true };
    },
  );

  /* ── POST /:id/sign/otp — send the акцепт code ────────────────── */

  fastify.post(
    '/:id/sign/otp',
    {
      config: { rateLimit: { max: 3, timeWindow: 60 * 1000 } },
      schema: {
        tags: TAGS,
        summary: 'Send the акцепт code',
        description:
          "On the client's own phone the SMS is not a second factor — whoever holds the " +
          'unlocked handset has both the app and the message. It is kept because it is the ' +
          'акцепт: the artifact that evidences consent to these terms, in the form a court ' +
          'recognizes. What actually secures this step is the MyID scan before it and the terms ' +
          'digest stamped after it.',
        security: SECURITY,
        params: IdParams,
        response: {
          200: Type.Object({ ok: Type.Boolean(), devOtp: Type.Optional(Type.String()) }),
          401: ERROR,
          404: ERROR,
          409: ERROR,
          429: ERROR,
        },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      let ctx: SigningContext;
      try {
        ctx = await loadSigningContext(request.params.id, Number(request.user.sub));
      } catch (e: any) {
        return signingErrorReply(reply, e);
      }

      // Order is enforced HERE, not by the app: no code before the face-scan.
      const signing = stepDataOf(ctx.session).signing;
      if (!isSigningProofFresh(signing?.myidVerifiedAt)) {
        return reply.code(409).sendError('myid_not_verified');
      }

      const res = await issueSigningOtp(ctx.user.phone, ctx.session.id);
      if (res.error === 'cooldown') {
        return reply.code(429).sendError('otp_cooldown', { seconds: res.seconds });
      }
      if (res.error === 'send_cap') return reply.code(429).sendError('otp_send_cap');

      return { ok: true, ...(isProd ? {} : { devOtp: res.code }) };
    },
  );

  /* ── POST /:id/sign/verify — the акцепт ───────────────────────── */

  const VerifyBody = Type.Object({ code: Type.String({ minLength: 1 }) });

  fastify.post(
    '/:id/sign/verify',
    {
      config: { rateLimit: { max: 10, timeWindow: 60 * 1000 } },
      schema: {
        tags: TAGS,
        summary: 'Confirm the акцепт code and sign',
        description:
          'The last act, and the one that produces the Deal. Stamps consent onto the session ' +
          'together with a digest of the exact terms consented to, then builds the Deal from ' +
          'that session server-side — the agent is no longer asked to confirm what the client ' +
          'has already signed. `dealCreated` reports whether that succeeded; when it is false ' +
          'the signature still stands and the seller finishes at the counter. The REASON it ' +
          'failed is deliberately not returned: every one of them is actionable only by the ' +
          'agent, and this response is read by a phone.',
        security: SECURITY,
        params: IdParams,
        body: VerifyBody,
        response: {
          200: Type.Object({
            ok: Type.Boolean(),
            signed: Type.Boolean(),
            dealCreated: Type.Boolean(),
          }),
          400: ERROR,
          401: ERROR,
          404: ERROR,
          409: ERROR,
          429: ERROR,
        },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      const userId = Number(request.user.sub);

      // Replay, checked BEFORE anything is spent. A confirmation that landed and then
      // lost its response — the tunnel dropped, the app retried — must not come back
      // as a failure, and it would come back as one twice over: a run that produced
      // its Deal is `completed` and invisible to loadSigningContext, and the code is
      // burnt either way, so the retry would read as a WRONG CODE to the one client
      // who entered the right one. The акцепт is already recorded; say so.
      const replayed = await loadSignedOutcome(request.params.id, userId);
      if (replayed) return { ok: true, signed: true, dealCreated: replayed.dealCreated };

      let ctx: SigningContext;
      try {
        ctx = await loadSigningContext(request.params.id, userId);
      } catch (e: any) {
        return signingErrorReply(reply, e);
      }

      const signing = stepDataOf(ctx.session).signing;
      if (!isSigningProofFresh(signing?.myidVerifiedAt)) {
        return reply.code(409).sendError('myid_not_verified');
      }

      const result = await verifySigningOtp(ctx.user.phone, request.body.code);
      if (result === 'attempts_exceeded') {
        return reply.code(429).sendError('otp_attempts_exceeded');
      }
      if (result === 'invalid') return reply.code(400).sendError('invalid_otp');

      // The stamp rewrites the run, and the Deal is built from what it wrote — so
      // the row it hands back is the one that goes forward, never `ctx.session`.
      const { session } = await stampOtpSigning(ctx.session, 'remote');

      const created = await autoCreateDealAfterSigning(session);
      if (created.status === 'failed') {
        // Logged, not returned. The agent gets the code off the session; this line
        // is for us, and it is the only place an unexpected cause survives.
        request.log.warn(
          { dealSessionId: session.id, code: created.code, err: created.cause },
          'remote signing: automatic deal creation failed',
        );
      }

      return { ok: true, signed: true, dealCreated: created.status === 'created' };
    },
  );
}

/**
 * Has this client already signed this run — and did it produce a Deal?
 *
 * Null means "no акцепт on record", i.e. an ordinary first attempt. Ownership is
 * re-checked here rather than borrowed from loadSigningContext, which refuses
 * completed runs — and a successful creation completes the run.
 *
 * The fresh-stamp branch answers without re-checking the code, which is not a hole:
 * the stamp IS the proof that this authenticated client entered the right code for
 * this session, GET /to-sign already tells them the same thing, and the reply grants
 * nothing — it reports a decision that is already recorded.
 */
async function loadSignedOutcome(
  sessionId: string,
  userId: number,
): Promise<{ dealCreated: boolean } | null> {
  // This runs before loadSigningContext, so it is now the first thing to touch a
  // path parameter. A non-UUID must fall through to the 404 that has always
  // answered it, not reach Postgres and come back a 500.
  if (!UUID_RE.test(sessionId)) return null;

  const [session] = await db
    .select()
    .from(dealSessions)
    .where(eq(dealSessions.id, sessionId))
    .limit(1);
  if (!session || session.userId !== userId) return null;

  if (await loadDealForSession(session.id)) return { dealCreated: true };

  // Signed, but the Deal did not get built — creation failed, and the reason is
  // parked on the run for the agent. The client is told the same thing they were
  // told the first time: it is signed, and the seller is finishing it.
  const stamp = stepDataOf(session).signing;
  if (isSigningProofFresh(stamp?.otpVerifiedAt)) return { dealCreated: false };

  return null;
}
