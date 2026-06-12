import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { clients } from '../../id/db/schema';
import { searchClients, findClientByPinflAndMerchant } from './queries/search-client';
import { createClient } from './commands/create-client';
import { createOtp, verifyOtp } from '../../auth/client/service';
import { createMyidSession, exchangeMyidCode } from '../../auth/client/myid';
import { createDealFromSession } from '../deals/commands/create-deal';
import { loadOwnedActiveSession } from '../deal-sessions/service';
import { env } from '../../../env';

function formatDealNumber(n: bigint | null | undefined): string {
  return n != null ? `CN-${String(n).padStart(7, '0')}` : '—';
}



function toClientDto(c: typeof clients.$inferSelect) {
  return {
    id: c.id.toString(),
    pinfl: c.pinfl,
    firstName: c.firstName,
    lastName: c.lastName,
    phone: c.phone,
    birthDate: c.birthDate,
    gender: c.gender,
    nationality: c.nationality,
    passportSerial: c.passportSerial,
    passportNumber: c.passportNumber,
    photoUrl: c.photoUrl,
    address: c.address,
    katmRegionCode: c.katmRegionCode,
    katmDistrictCode: c.katmDistrictCode,
    docType: c.docType,
  };
}

interface RegTokenPhase1 {
  phone: string;
  step: 'phone_verified';
}

interface RegTokenPhase2 {
  phone: string;
  pinfl: string;
  myidSessionId: string;
  merchantId: string;
  branchId: string;
  step: 'pinfl_verified';
}

export default async function merchantClientRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const db = app.db;
  const redis = app.redis;

  const SearchQuery = Type.Object({
    q: Type.String({ minLength: 1, maxLength: 100 }),
  });
  const OtpBody = Type.Object({
    phone: Type.String({ minLength: 12, maxLength: 12 }),
  });
  const OtpVerifyBody = Type.Object({
    phone: Type.String({ minLength: 12, maxLength: 12 }),
    code: Type.String({ minLength: 4, maxLength: 4 }),
  });
  const MyidSessionBody = Type.Object({
    regToken: Type.String({ minLength: 1 }),
    pinfl: Type.String({ minLength: 14, maxLength: 14, pattern: '^\\d{14}$' }),
    retry: Type.Boolean({ default: false }),
  });
  const MyidCompleteBody = Type.Object({
    regToken: Type.String({ minLength: 1 }),
    myidCode: Type.String({ minLength: 1 }),
  });

  /* ── Search ─────────────────────────────────────────────────────────────── */

  fastify.get(
    '/search',
    { schema: { querystring: SearchQuery }, preHandler: app.verifyMerchantJwt },
    async (request) => {
      const payload = request.user as { sub: string; merchantId: string };
      const { q } = request.query;
      const results = await searchClients(db, q, BigInt(payload.merchantId));
      return { clients: results.map(toClientDto) };
    },
  );

  /* ── OTP ────────────────────────────────────────────────────────────────── */
  // merchant/client/otp
  fastify.post(
    '/otp',
    { schema: { body: OtpBody }, preHandler: app.verifyMerchantJwt },
    async (req) => {
      const {phone} = req.body
      const isProd = app.hasDecorator('isProd')
        ? (app as any).isProd
        : process.env['NODE_ENV'] === 'production';

      const code = await createOtp(db, phone, 'client_registration');
      if (!isProd) req.log.info({ phone, code }, 'client_registration OTP issued');

      return { ok: true, ...(isProd ? {} : { devOtp: code }) };
    },
  );

  fastify.post(
    '/otp/verify',
    { schema: { body: OtpVerifyBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const { phone } = request.body;
      const ok = await verifyOtp(db, phone, request.body.code, 'client_registration');
      if (!ok) return reply.code(400).sendError('invalid_otp');

      const regToken = app.jwt.sign({ phone, step: 'phone_verified' } satisfies RegTokenPhase1, {
        expiresIn: '15m',
      });
      return { regToken };
    },
  );

  /* ── MyID session ───────────────────────────────────────────────────────── */

  fastify.post(
    '/myid-session',
    { schema: { body: MyidSessionBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      let phase1: RegTokenPhase1;
      try {
        phase1 = app.jwt.verify<RegTokenPhase1>(request.body.regToken);
      } catch {
        return reply.code(400).sendError('invalid_reg_token');
      }
      if (phase1.step !== 'phone_verified' && !request.body.retry) {
        return reply.code(400).sendError('invalid_step');
      }

      const payload = request.user as {
        merchantId: string;
        branchId: string;
      };
      const { pinfl } = request.body;

      const existing = await findClientByPinflAndMerchant(db, pinfl, BigInt(payload.merchantId));
      if (existing) return reply.code(409).sendError('client_already_registered');
      const redirectUrl = encodeURIComponent(
        env.MERCHANT_PORTAL_URL + '/myid/callback/registration',
      );

      const myidResult = await createMyidSession(db, redis, pinfl, request.ip, redirectUrl);

      const regToken = app.jwt.sign(
        {
          phone: phase1.phone,
          pinfl,
          myidSessionId: myidResult.sessionId,
          merchantId: payload.merchantId,
          branchId: payload.branchId,
          step: 'pinfl_verified',
        } satisfies RegTokenPhase2,
        { expiresIn: '15m' },
      );

      return { regToken, redirectUrl: myidResult.redirectUrl };
    },
  );

  /* ── MyID complete ──────────────────────────────────────────────────────── */

  fastify.post(
    '/myid-complete',
    { schema: { body: MyidCompleteBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      let phase2: RegTokenPhase2;
      try {
        phase2 = app.jwt.verify<RegTokenPhase2>(request.body.regToken);
      } catch {
        return reply.code(400).sendError('invalid_reg_token');
      }
      if (phase2.step !== 'pinfl_verified') {
        return reply.code(400).sendError('invalid_step');
      }

      const myidUser = await exchangeMyidCode(db, redis, request.body.myidCode);
      if (myidUser.pinfl !== phase2.pinfl) {
        return reply.code(400).sendError('pinfl_mismatch');
      }

      const merchantId = BigInt(phase2.merchantId);
      const branchId = BigInt(phase2.branchId);

      const existing = await findClientByPinflAndMerchant(db, phase2.pinfl, merchantId);
      if (existing) return { client: toClientDto(existing), isNew: false };

      const client = await createClient(db, {
        phone: phase2.phone,
        pinfl: myidUser.pinfl,
        firstName: myidUser.firstName,
        lastName: myidUser.lastName,
        birthDate: myidUser.birthDate,
        gender: myidUser.gender,
        nationality: myidUser.nationality,
        passportSerial: myidUser.passportSerial,
        passportNumber: myidUser.passportNumber,
        photoUrl: myidUser.photoUrl,
        address: myidUser.address,
        katmRegionCode: myidUser.regionCode,
        katmDistrictCode: myidUser.districtCode,
        docType: myidUser.docType,
        merchantId,
        branchId,
      });

      return { client: toClientDto(client), isNew: true };
    },
  );

  /* ── KATM details (manual entry) ────────────────────────────────────────── */

  const KatmDetailsBody = Type.Object({
    address: Type.String({ minLength: 1, maxLength: 100 }),
    katmRegionCode: Type.String({ minLength: 1, maxLength: 2, pattern: '^\\d{1,2}$' }),
    katmDistrictCode: Type.String({ minLength: 1, maxLength: 3, pattern: '^\\d{1,3}$' }),
    docType: Type.Union([Type.Literal(0), Type.Literal(6)]),
  });

  /**
   * PATCH /merchant/client/:id/katm-details
   * Agent manual entry of the KATM claim-registration fields for client rows
   * created before they were captured from MyID (ADR-0025). The Wizard offers
   * this form when /merchant/katm/query answers client_katm_fields_missing.
   */
  fastify.patch(
    '/:id/katm-details',
    {
      schema: {
        params: Type.Object({ id: Type.String({ pattern: '^\\d+$' }) }),
        body: KatmDetailsBody,
      },
      preHandler: app.verifyMerchantJwt,
    },
    async (request, reply) => {
      const id = BigInt(request.params.id);
      const [updated] = await db
        .update(clients)
        .set({
          address: request.body.address,
          katmRegionCode: request.body.katmRegionCode.padStart(2, '0'),
          katmDistrictCode: request.body.katmDistrictCode.padStart(3, '0'),
          docType: request.body.docType,
        })
        .where(eq(clients.id, id))
        .returning();
      if (!updated) return reply.code(404).sendError('client_not_found');
      return { client: toClientDto(updated) };
    },
  );

  /* ── Kontrakt signing OTP ───────────────────────────────────────────────── */

  const SignOtpBody = Type.Object({
    phone: Type.String({ minLength: 1 }),
  });

  const SignOtpVerifyBody = Type.Object({
    phone: Type.String({ minLength: 1 }),
    code: Type.String({ minLength: 1 }),
  });

  /**
   * POST /merchant/client/sign-otp
   * Send a one-time code to the Client's phone as their digital consent to the
   * Kontrakt terms. Uses purpose "deal_signing" — a separate OTP namespace
   * from client_registration so codes never collide.
   */
  fastify.post(
    '/sign-otp',
    { schema: { body: SignOtpBody }, preHandler: app.verifyMerchantJwt },
    async (request) => {
      const { phone } = request.body;
      const isProd = app.hasDecorator('isProd')
        ? (app as any).isProd
        : process.env['NODE_ENV'] === 'production';

      const code = await createOtp(db, phone, 'deal_signing');
      if (!isProd) request.log.info({ phone, code }, 'deal_signing OTP issued');

      return { ok: true, ...(isProd ? {} : { devOtp: code }) };
    },
  );

  /**
   * POST /merchant/client/sign-otp/verify
   * Verify the signing OTP the Client read to the Agent. On success returns a
   * short-lived signingToken the frontend attaches to the deal-creation call as
   * proof of client consent.
   */
  fastify.post(
    '/sign-otp/verify',
    { schema: { body: SignOtpVerifyBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const { phone } = request.body;
      const ok = await verifyOtp(db, phone, request.body.code, 'deal_signing');
      if (!ok) return reply.code(400).sendError('invalid_otp');

      // Short-lived token carried with the deal-creation call as proof of signing
      const signingToken = app.jwt.sign({ phone, purpose: 'deal_signing' }, { expiresIn: '10m' });
      return { signingToken };
    },
  );

  /* ── MyID signing session ───────────────────────────────────────────────── */

  const MyidSignSessionBody = Type.Object({
    pinfl: Type.String({ minLength: 14, maxLength: 14, pattern: '^\\d{14}$' }),
  });

  const MyidSignCompleteBody = Type.Object({
    signingSessionToken: Type.String({ minLength: 1 }),
    myidCode: Type.String({ minLength: 1 }),
    // OTP consent proof + the Deal Session the deal is built from (ADR-0024) —
    // one call total from the callback view.
    signingToken: Type.String({ minLength: 1 }),
    dealSessionId: Type.String({ minLength: 1 }),
  });

  /**
   * POST /merchant/client/myid-sign-session
   * Create a MyID session for Kontrakt signing. Unlike /myid-session (which is
   * gated behind a registration OTP regToken), this endpoint takes the Client's
   * PINFL directly — the Client is already known at this point in the Wizard.
   * Returns a redirectUrl pointing to the MyID iframe and a signingSessionToken
   * to correlate the callback.
   */
  fastify.post(
    '/myid-sign-session',
    { schema: { body: MyidSignSessionBody }, preHandler: app.verifyMerchantJwt },
    async (request) => {
      const { pinfl } = request.body;
      const redirectUrl = encodeURIComponent(
        env.MERCHANT_PORTAL_URL + '/myid/callback/signing_deal',
      );

      const myidResult = await createMyidSession(db, redis, pinfl, request.ip, redirectUrl);

      const signingSessionToken = app.jwt.sign(
        { pinfl, myidSessionId: myidResult.sessionId, purpose: 'deal_signing' },
        { expiresIn: '15m' },
      );

      return { signingSessionToken, redirectUrl: myidResult.redirectUrl };
    },
  );

  /**
   * POST /merchant/client/myid-sign-complete
   * Single-call endpoint used by the MyID signing callback:
   *  1. Verifies the OTP signingToken (client consent proof)
   *  2. Verifies the signingSessionToken (MyID session correlation)
   *  3. Exchanges the MyID auth_code and confirms PINFL match
   *  4. Creates the deal atomically from the Deal Session via createDealFromSession
   * Returns { verified: true, dealId }.
   */
  fastify.post(
    '/myid-sign-complete',
    { schema: { body: MyidSignCompleteBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const jwtPayload = request.user as {
        sub: string;
        merchantId: string;
        branchId: string;
        role: string;
      };

      // ── 1. Verify OTP consent token ────────────────────────────────────────
      let signingPayload: { phone: string; purpose: string };
      try {
        signingPayload = app.jwt.verify<{ phone: string; purpose: string }>(
          request.body.signingToken,
        );
      } catch {
        return reply.code(400).sendError('invalid_signing_token');
      }
      if (signingPayload.purpose !== 'deal_signing') {
        return reply.code(400).sendError('invalid_signing_purpose');
      }

      // ── 2. Verify MyID session token ───────────────────────────────────────
      let session: { pinfl: string; purpose: string };
      try {
        session = app.jwt.verify<{ pinfl: string; purpose: string }>(
          request.body.signingSessionToken,
        );
      } catch {
        return reply.code(400).sendError('invalid_signing_session');
      }
      if (session.purpose !== 'deal_signing') {
        return reply.code(400).sendError('invalid_purpose');
      }

      // ── 3. Exchange MyID code & confirm PINFL ──────────────────────────────
      const myidUser = await exchangeMyidCode(db, redis, request.body.myidCode);
      if (myidUser.pinfl !== session.pinfl) {
        return reply.code(400).sendError('pinfl_mismatch');
      }

      // ── 4. Create deal atomically from the Deal Session ────────────────────
      let deal: Awaited<ReturnType<typeof createDealFromSession>>;
      try {
        const dealSession = await loadOwnedActiveSession(
          db,
          request.body.dealSessionId,
          BigInt(jwtPayload.sub),
        );
        deal = await createDealFromSession(db, dealSession);
      } catch (err: any) {
        if (err.code === 'session_not_found') return reply.code(404).sendError('session_not_found');
        if (err.code === 'session_not_active') return reply.code(409).sendError('session_not_active');
        if (err.code === 'session_incomplete') return reply.code(409).sendError('session_incomplete');
        if (err.code === 'scoring_missing') return reply.code(409).sendError('scoring_missing');
        if (err.code === 'scoring_declined') return reply.code(409).sendError('scoring_declined');
        if (err.code === 'product_not_found') return reply.code(400).sendError('product_not_found');
        if (err.code === 'amount_below_tariff_min') return reply.code(400).sendError('amount_below_tariff_min');
        if (err.code === 'amount_above_tariff_max') return reply.code(400).sendError('amount_above_tariff_max');
        throw err;
      }

      return reply
        .code(201)
        .send({ verified: true, dealId: deal.id, dealNumber: formatDealNumber(deal.dealNumber) });
    },
  );
}
