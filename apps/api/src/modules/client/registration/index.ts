import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { redis } from '@redis';
import { env } from '@env';
import { users } from '@db/schema';
import {
  createOtp,
  verifyOtp,
  createSession,
  findUserByPinfl,
} from '../../auth/client/service/service.handler';
import { createMyidSession, exchangeMyidCode } from '../../integrations/myid/client';
import { createUserHandler } from '../../id/users';
import { sendOtpSms } from '../../../lib/sms';

// Self-service client registration (mobile app). Public endpoints — no JWT.
// Mirrors merchant/client otp→myid flow, but anonymous: no merchantId/branchId,
// and myid-complete mints a client session instead of returning a DTO.

const OTP_COOLDOWN_SECONDS = 60;
const OTP_DAILY_LIMIT = 10;
const OTP_DAILY_TTL = 24 * 60 * 60;
const ACCESS_TOKEN_TTL = '15m';
const REG_TOKEN_TTL = '15m';

interface RegTokenPhase1 {
  phone: string;
  step: 'phone_verified';
}

interface RegTokenPhase2 {
  phone: string;
  pinfl: string;
  step: 'pinfl_verified';
}

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

export default async function clientRegistrationRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const isProd = env.NODE_ENV === 'production';

  const TAGS = ['Client · Registration'];

  const OtpBody = Type.Object({
    phone: Type.String({ minLength: 12, maxLength: 12, examples: ['998991234567'] }),
  });
  const OtpVerifyBody = Type.Object({
    phone: Type.String({ minLength: 12, maxLength: 12, examples: ['998991234567'] }),
    code: Type.String({ minLength: 4, maxLength: 4, examples: ['1234'] }),
  });
  const MyidSessionBody = Type.Object({
    regToken: Type.String({ minLength: 1, examples: ['ey.....'] }),
    pinfl: Type.String({
      minLength: 14,
      maxLength: 14,
      pattern: '^\\d{14}$',
      examples: ['12345678901234'],
    }),
  });
  const MyidCompleteBody = Type.Object({
    regToken: Type.String({ minLength: 1, examples: ['ey..'] }),
    myidCode: Type.String({ minLength: 1, examples: ['jfkdjfkd'] }),
  });

  /* ── OTP issue ──────────────────────────────────────────────────────────── */

  fastify.post('/otp', { schema: { tags: TAGS, body: OtpBody } }, async (req, reply) => {
    const { phone } = req.body;

    // Per-phone cooldown: at most one code every OTP_COOLDOWN_SECONDS.
    const cooldownKey = `client:otp:cooldown:${phone}`;
    const onCooldown = await redis.get(cooldownKey).catch(() => null);
    if (onCooldown) return reply.code(429).sendError('otp_cooldown');

    // Per-phone daily cap.
    const dailyKey = `client:otp:daily:${phone}`;
    const count = await redis.incr(dailyKey).catch(() => 0);
    if (count === 1) await redis.expire(dailyKey, OTP_DAILY_TTL).catch(() => undefined);
    if (count > OTP_DAILY_LIMIT) return reply.code(429).sendError('otp_daily_limit');

    const code = await createOtp(phone, 'register');
    await redis.set(cooldownKey, '1', 'EX', OTP_COOLDOWN_SECONDS).catch(() => undefined);
    await sendOtpSms(phone, code);

    if (!isProd) req.log.info({ phone, code }, 'client register OTP issued');
    return { ok: true, ...(isProd ? {} : { devOtp: code }) };
  });

  /* ── OTP verify ─────────────────────────────────────────────────────────── */

  fastify.post(
    '/otp/verify',
    { schema: { tags: TAGS, body: OtpVerifyBody } },
    async (req, reply) => {
      const { phone } = req.body;
      const ok = await verifyOtp(phone, req.body.code, 'register');
      if (!ok) return reply.code(400).sendError('invalid_otp');

      const regToken = app.jwt.sign({ phone, step: 'phone_verified' } satisfies RegTokenPhase1, {
        expiresIn: REG_TOKEN_TTL,
      });
      return { regToken };
    },
  );

  /* ── MyID session ───────────────────────────────────────────────────────── */

  fastify.post(
    '/myid-session',
    { schema: { tags: TAGS, body: MyidSessionBody } },
    async (req, reply) => {
      let payload: RegTokenPhase1 | RegTokenPhase2;
      try {
        payload = app.jwt.verify<RegTokenPhase1 | RegTokenPhase2>(req.body.regToken);
      } catch {
        return reply.code(400).sendError('invalid_reg_token');
      }
      // Accept either a freshly phone-verified token or an already pinfl-verified
      // one — re-issuing a MyID session after a failed liveness scan is always
      // legitimate (the phone is already proven). 15m token expiry bounds it.
      if (payload.step !== 'phone_verified' && payload.step !== 'pinfl_verified') {
        return reply.code(400).sendError('invalid_step');
      }

      const { pinfl } = req.body;
      const myidResult = await createMyidSession(pinfl, req.ip);

      const regToken = app.jwt.sign(
        { phone: payload.phone, pinfl, step: 'pinfl_verified' } satisfies RegTokenPhase2,
        { expiresIn: REG_TOKEN_TTL },
      );
      return { regToken, sessionId: myidResult.sessionId };
    },
  );

  /* ── MyID complete ──────────────────────────────────────────────────────── */

  fastify.post(
    '/myid-complete',
    { schema: { tags: TAGS, body: MyidCompleteBody } },
    async (req, reply) => {
      let phase2: RegTokenPhase2;
      try {
        phase2 = app.jwt.verify<RegTokenPhase2>(req.body.regToken);
      } catch {
        return reply.code(400).sendError('invalid_reg_token');
      }
      if (phase2.step !== 'pinfl_verified') {
        return reply.code(400).sendError('invalid_step');
      }

      const myidUser = await exchangeMyidCode(req.body.myidCode);
      if (myidUser.pinfl !== phase2.pinfl) {
        return reply.code(400).sendError('pinfl_mismatch');
      }

      // Idempotent on the MyID-verified PINFL. If the identity already has an
      // account it must belong to the same OTP-verified phone, otherwise reject.
      const existing = await findUserByPinfl(phase2.pinfl);
      let client: typeof users.$inferSelect;
      if (existing) {
        if (existing.phone !== phase2.phone) {
          return reply.code(409).sendError('phone_pinfl_mismatch');
        }
        client = existing;
      } else {
        client = await createUserHandler({
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
          regionCode: myidUser.regionCode ?? '',
          districtCode: myidUser.districtCode ?? '',
          docType: myidUser.docType || 1,
          citizenShipId: myidUser.citizenShipId,
          gender: +myidUser.gender,
          verifiedAt: new Date(),
        });
      }

      const accessToken = app.jwt.sign(
        { sub: client.id.toString(), type: 'client' },
        { expiresIn: ACCESS_TOKEN_TTL },
      );
      const { sessionToken } = await createSession(client.id);

      return { accessToken, sessionToken, client: toClientDto(client) };
    },
  );
}
