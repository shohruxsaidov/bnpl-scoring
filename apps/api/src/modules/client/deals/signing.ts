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

// ---------------------------------------------------------------------------
// Client Deal Signing — the client signs on their OWN phone.
//
// A merchant Agent, with the client standing at the counter, asks them to sign
// there rather than on the Agent's tablet: the client already has the app (it is
// how they got their limit), so the face-scan happens through the MyID SDK they
// have already used, and the акцепт code lands on the phone that is in their hand.
//
// What is being signed is a DEAL SESSION — the Deal does not exist yet and will
// not until the Agent presses Создать сделку. The client's two proofs are stamped
// onto that session; nothing here creates, approves or funds anything. Deal
// creation can fail for reasons only an Agent can fix (a product went inactive, a
// tariff bound moved), and those errors belong on the Agent's screen, not on a
// phone in someone's pocket.
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
          'On the client\'s own phone the SMS is not a second factor — whoever holds the ' +
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
          'The last act. Stamps consent onto the session together with a digest of the exact ' +
          'terms consented to — which the Agent\'s Создать сделку then re-checks, so the Deal ' +
          'that gets built cannot be for a basket the client never saw. The Deal itself is NOT ' +
          'created here: the Agent creates it, because that is where its failures can be fixed.',
        security: SECURITY,
        params: IdParams,
        body: VerifyBody,
        response: {
          200: Type.Object({ ok: Type.Boolean(), signed: Type.Boolean() }),
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
      let ctx: SigningContext;
      try {
        ctx = await loadSigningContext(request.params.id, Number(request.user.sub));
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

      await stampOtpSigning(ctx.session, 'remote');
      return { ok: true, signed: true };
    },
  );
}
