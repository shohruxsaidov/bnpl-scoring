import { env } from './../../../env';
import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import type { users } from '../../id/db/schema.js';
import {
  clearDeviceFcmToken,
  createOtp,
  createSession,
  createUser,
  findUserById,
  findUserByPhone,
  findUserByPinfl,
  revokeSession,
  upsertDevice,
  verifyOtp,
  verifySession,
} from './service.js';
import { createMyidSession, exchangeMyidCode } from './myid';

const ACCESS_MAX_AGE = 15 * 60; // seconds

const isProd = env.NODE_ENV === 'production';

/** Reg-token shape carried between registration steps. */
interface RegTokenPhase1 {
  phone: string;
  step: 'phone_verified';
}
interface RegTokenPhase2 {
  phone: string;
  pinfl: string;
  myidSessionId: string;
  step: 'pinfl_verified';
}

function makeTokens(app: FastifyInstance, userId: number, sessionToken: string) {
  const accessToken = app.jwt.sign(
    { sub: userId.toString(), type: 'client' },
    { expiresIn: ACCESS_MAX_AGE },
  );
  return { accessToken, sessionToken };
}

function toUserDto(u: typeof users.$inferSelect) {
  return {
    id: u.id.toString(),
    phone: u.phone,
    firstName: u.firstName,
    lastName: u.lastName,
    birthDate: u.birthDate,
    gender: u.gender,
    nationality: u.nationality,
    passportSerial: u.passportSerial,
    passportNumber: u.passportNumber,
    photoUrl: u.photoUrl,
  };
}

export default async function clientAuthRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const db = app.db;
  const redis = app.redis;

  const DeviceInput = Type.Optional(
    Type.Object({
      deviceId: Type.String({ minLength: 1 }),
      fcmToken: Type.String({ minLength: 1 }),
      platform: Type.Union([Type.Literal('ios'), Type.Literal('android')]),
      appVersion: Type.String({ minLength: 1 }),
    }),
  );

  const PhoneBody = Type.Object({
    phone: Type.String({ minLength: 12, maxLength: 12 }),
  });
  const OtpBody = Type.Object({
    phone: Type.String({ minLength: 12, maxLength: 12 }),
    code: Type.String({ minLength: 1 }),
    device: DeviceInput,
  });
  const RegisterOtpBody = Type.Object({
    phone: Type.String({ minLength: 12, maxLength: 12 }),
    code: Type.String({ minLength: 1 }),
  });
  const PinflBody = Type.Object({
    regToken: Type.String({ minLength: 1 }),
    pinfl: Type.String({ minLength: 14, maxLength: 14 }),
  });
  const CompleteBody = Type.Object({
    regToken: Type.String({ minLength: 1 }),
    myidCode: Type.String({ minLength: 1 }),
    device: DeviceInput,
  });

  /* ── Registration ───────────────────────────────────────────────────────── */

  fastify.post('/register/phone', { schema: { body: PhoneBody } }, async (request, reply) => {
    const { phone } = request.body;

    const existing = await findUserByPhone(db, phone);
    if (existing) return reply.code(409).sendError('phone_taken');

    const code = await createOtp(db, phone, 'register');
    if (!isProd) request.log.info({ phone, code }, 'register OTP issued');

    return { ok: true, ...(isProd ? {} : { devOtp: code }) };
  });

  fastify.post('/register/otp', { schema: { body: RegisterOtpBody } }, async (request, reply) => {
    const { phone } = request.body;

    const ok = await verifyOtp(db, phone, request.body.code, 'register');
    if (!ok) return reply.code(400).sendError('invalid_otp');

    const regToken = app.jwt.sign({ phone, step: 'phone_verified' } satisfies RegTokenPhase1, {
      expiresIn: '15m',
    });

    return { regToken };
  });

  fastify.post('/register/pinfl', { schema: { body: PinflBody } }, async (request, reply) => {
    let payload: RegTokenPhase1;
    try {
      payload = app.jwt.verify<RegTokenPhase1>(request.body.regToken);
    } catch {
      return reply.code(400).sendError('invalid_reg_token');
    }
    if (payload.step !== 'phone_verified') {
      return reply.code(400).sendError('invalid_step');
    }

    const pinfl = request.body.pinfl.trim();
    if (pinfl.length !== 14 || !/^\d{14}$/.test(pinfl)) {
      return reply.code(400).sendError('invalid_pinfl');
    }

    const existing = await findUserByPinfl(db, pinfl);
    if (existing) return reply.code(409).sendError('pinfl_taken');

    // Client portal lives on its own host, so it needs a dedicated MyID redirect
    // base; fall back to the merchant base when not configured.
    const clientRedirectBase = env.CLIENT_PORTAL_URL;
    const redirectUrl = encodeURIComponent(clientRedirectBase + '/myid/callback/signing_up');

    const myidResult = await createMyidSession(db, redis, pinfl, request.ip, redirectUrl).catch(
      (err) => {
        request.log.error({ err }, 'MyID session creation failed, falling back to mock');
        return null;
      },
    );
    if (myidResult === null) {
      // In case of MyID integration failure throw an error in production, but allow fallback to mock data in non-production environments for testing purposes.
      return reply.code(500).sendError('myid_integration_failed');
    }

    const regToken = app.jwt.sign(
      {
        phone: payload.phone,
        pinfl,
        myidSessionId: myidResult.sessionId,
        step: 'pinfl_verified',
      } satisfies RegTokenPhase2,
      { expiresIn: '15m' },
    );

    return { regToken, redirectUrl: myidResult.redirectUrl };
  });

  fastify.post('/register/complete', { schema: { body: CompleteBody } }, async (request, reply) => {
    let payload: RegTokenPhase2;
    try {
      payload = app.jwt.verify<RegTokenPhase2>(request.body.regToken);
    } catch {
      return reply.code(400).sendError('invalid_reg_token');
    }
    if (payload.step !== 'pinfl_verified') {
      return reply.code(400).sendError('invalid_step');
    }

    const myidUser = await exchangeMyidCode(db, redis, request.body.myidCode);

    if (myidUser.pinfl !== payload.pinfl) {
      return reply.code(400).sendError('pinfl_mismatch');
    }

    const existing = await findUserByPinfl(db, payload.pinfl);
    if (existing) return reply.code(409).sendError('pinfl_taken');

    const user = await createUser(db, {
      phone: payload.phone,
      pinfl: myidUser.pinfl,
      firstName: myidUser.firstName,
      lastName: myidUser.lastName,
      birthDate: myidUser.birthDate,
      middleName: myidUser.middleName,
      gender: myidUser.gender,
      nationality: myidUser.nationality,
      passportSerial: myidUser.passportSerial,
      passportNumber: myidUser.passportNumber,
      photoUrl: myidUser.photoUrl,
    });

    const { sessionToken } = await createSession(db, user.id);
    if (request.body.device) {
      await upsertDevice(db, { userId: user.id, ...request.body.device });
    }

    return { ...makeTokens(app, user.id, sessionToken), user: toUserDto(user) };
  });

  /* ── Login ──────────────────────────────────────────────────────────────── */

  fastify.post('/login/phone', { schema: { body: PhoneBody } }, async (request, reply) => {
    const { phone } = request.body;

    const user = await findUserByPhone(db, phone);
    if (!user) return reply.code(404).sendError('no_account');

    const code = await createOtp(db, phone, 'login');
    if (!isProd) request.log.info({ phone, code }, 'login OTP issued');

    return { ok: true, ...(isProd ? {} : { devOtp: code }) };
  });

  fastify.post('/login/otp', { schema: { body: OtpBody } }, async (request, reply) => {
    const { phone } = request.body;

    const ok = await verifyOtp(db, phone, request.body.code, 'login');
    if (!ok) return reply.code(400).sendError('invalid_otp');

    const user = await findUserByPhone(db, phone);
    if (!user) return reply.code(404).sendError('no_account');

    const { sessionToken } = await createSession(db, user.id);
    if (request.body.device) {
      await upsertDevice(db, { userId: user.id, ...request.body.device });
    }

    return { ...makeTokens(app, user.id, sessionToken), user: toUserDto(user) };
  });

  /* ── Session lifecycle ──────────────────────────────────────────────────── */

  fastify.get('/me', { preHandler: app.verifyClientJwt }, async (request, reply) => {
    const payload = request.user as { sub: string; type: 'client' };
    const user = await findUserById(db, Number(payload.sub));
    if (!user) return reply.code(401).sendError('unauthorized');
    return { user: toUserDto(user) };
  });

  const SessionBody = Type.Object({
    sessionToken: Type.String({ minLength: 1 }),
    deviceId: Type.Optional(Type.String({ minLength: 1 })),
  });

  fastify.post('/refresh', { schema: { body: SessionBody } }, async (request, reply) => {
    const { sessionToken } = request.body;

    const result = await verifySession(db, sessionToken);
    if (!result) return reply.code(401).sendError('unauthorized');

    const accessToken = app.jwt.sign(
      { sub: result.user.id.toString(), type: 'client' },
      { expiresIn: ACCESS_MAX_AGE },
    );

    return { accessToken };
  });

  fastify.post('/logout', { schema: { body: SessionBody } }, async (request) => {
    await revokeSession(db, request.body.sessionToken);
    if (request.body.deviceId) {
      await clearDeviceFcmToken(db, request.body.deviceId);
    }
    return { ok: true };
  });
}
