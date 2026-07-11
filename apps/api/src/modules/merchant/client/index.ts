import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '@db';
import { users } from '@db/schema';
import { findClientByPinflAndMerchant } from './queries/search-client/search-client.handler';
import { createOtp, verifyOtp } from '../../auth/client/service/service.handler';
import { createMyidSession, exchangeMyidCode } from '../../integrations/myid/client';
import { env } from '../../../env';
import { createUserHandler } from '../../id/users';
import { findUsersHandler } from '../../id/users/queries/find-user/find-user.handler';

const UZBEKISTAN_CITIZENSHIP_ID = '182';

function toClientDto(c: typeof users.$inferSelect) {
  return {
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
    photoUrl: c.photoUrl,
    address: c.address,
    regionCode: c.regionCode,
    districtCode: c.districtCode,
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

const TAGS = ['Merchant · Client'];

export default async function merchantClientRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();

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
    { schema: { tags: TAGS, querystring: SearchQuery }, preHandler: app.verifyMerchantJwt },
    async (request) => {
      const results = await findUsersHandler({ query: request.query.q });
      return { clients: results.map(toClientDto) };
    },
  );

  /* ── OTP ────────────────────────────────────────────────────────────────── */
  // merchant/client/otp
  fastify.post(
    '/otp',
    { schema: { tags: TAGS, body: OtpBody }, preHandler: app.verifyMerchantJwt },
    async (req, reply) => {
      const { phone } = req.body;

      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phone, phone))
        .limit(1);
      if (existing.length) return reply.code(409).sendError('phone_already_registered');

      const isProd = app.hasDecorator('isProd')
        ? (app as any).isProd
        : process.env['NODE_ENV'] === 'production';

      const code = await createOtp(phone, 'client_registration');
      if (!isProd) req.log.info({ phone, code }, 'client_registration OTP issued');

      return { ok: true, ...(isProd ? {} : { devOtp: code }) };
    },
  );

  fastify.post(
    '/otp/verify',
    { schema: { tags: TAGS, body: OtpVerifyBody }, preHandler: app.verifyMerchantJwt },
    async (request, reply) => {
      const { phone } = request.body;
      const ok = await verifyOtp(phone, request.body.code, 'client_registration');
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
    { schema: { tags: TAGS, body: MyidSessionBody }, preHandler: app.verifyMerchantJwt },
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

      const existing = await findClientByPinflAndMerchant(pinfl, Number(payload.merchantId));
      if (existing) return reply.code(409).sendError('client_already_registered');
      const redirectUrl = encodeURIComponent(
        env.MERCHANT_PORTAL_URL + '/myid/callback/registration',
      );

      const myidResult = await createMyidSession(pinfl, request.ip, redirectUrl);

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
    { schema: { tags: TAGS, body: MyidCompleteBody }, preHandler: app.verifyMerchantJwt },
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

      const myidUser = await exchangeMyidCode(request.body.myidCode);
      if (myidUser.pinfl !== phase2.pinfl) {
        return reply.code(400).sendError('pinfl_mismatch');
      }

      const merchantId = Number(phase2.merchantId);
      const branchId = Number(phase2.branchId);

      const existing = await findUsersHandler({ query: phase2.pinfl });
      if (existing.length) return { client: toClientDto(existing[0]), isNew: false };

      const client = await createUserHandler({
        phone: phase2.phone,
        pinfl: myidUser.pinfl,
        firstName: myidUser.firstName,
        lastName: myidUser.lastName,
        middleName: myidUser.middleName || '',
        birthDate: myidUser.birthDate,
        nationality: myidUser.nationality,
        passportSeries: myidUser.passportSerial,
        passportNumber: myidUser.passportNumber,
        address: myidUser.address || undefined,
        temporaryRegistration: myidUser.temporaryRegistration,
        permanentRegistration: myidUser.permanentRegistration,
        regionCode: myidUser.regionCode,
        districtCode: myidUser.districtCode,
        docType: myidUser.docType || 1,
        citizenShipId: myidUser.citizenShipId || UZBEKISTAN_CITIZENSHIP_ID,
        gender: +myidUser.gender,
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

  // Kontrakt signing (MyID face-scan + акцепт OTP) lives on the Deal Session it
  // stamps — see /merchant/deal-sessions/:id/myid-sign and .../sign-otp. It was
  // moved out of here so the PINFL comes from the session's client row instead of
  // the request body.
}
