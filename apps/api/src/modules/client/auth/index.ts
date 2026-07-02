import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { redis } from '@redis';
import { env } from '@env';
import { users } from '@db/schema';
import {
  activateDevice,
  createSession,
  findDeviceByDeviceId,
  findUserById,
  findUserByPhone,
  revokeDeviceSessions,
  rotateSession,
  revokeSession,
  setUserPin,
  verifyUserPin,
} from '../../auth/client/service/service.handler';

// Onboarding token minted by registration/myid-complete. Carries no `type`
// field, so it cannot pass verifyClientJwt as an access token; only /setup
// accepts it.
interface RegTokenSetup {
  sub: string;
  step: 'identity_verified';
}

// Client app re-auth: PIN login, biometric/refresh via durable session exchange,
// and logout. Identity on PIN login comes from the phone (account-bound PIN);
// biometric never reaches the server — it only unlocks the Keychain-stored
// session token, which /session exchanges for a fresh access token.

const ERROR = { $ref: 'ErrorResponse#' };
const SECURITY = [{ clientAuth: [] }];

const ACCESS_TOKEN_TTL = '15m';

// 5 wrong PINs (per phone) lock PIN login until a full OTP + MyID re-auth clears
// the counter (see registration/myid-complete). The TTL is a safety backstop so
// an abandoned counter cannot lock an account forever.
const PIN_MAX_ATTEMPTS = 5;
const PIN_LOCK_TTL = env.SESSION_EXPIRES_DAYS * 24 * 60 * 60;

/** Redis key holding the consecutive failed-PIN count for a phone. */
export function pinFailKey(phone: string): string {
  return `client:pin:fails:${phone}`;
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

export default async function clientAuthRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Client · Auth'];

  const Pin = Type.String({
    minLength: 4,
    maxLength: 4,
    pattern: '^\\d{4}$',
    examples: ['1234'],
  });

  const ClientDto = Type.Object({
    id: Type.String(),
    pinfl: Type.String(),
    firstName: Type.String(),
    lastName: Type.String(),
    phone: Type.String(),
    birthDate: Type.Union([Type.String(), Type.Null()]),
    gender: Type.Union([Type.Integer(), Type.Null()]),
    nationality: Type.Union([Type.String(), Type.Null()]),
    passportSeries: Type.Union([Type.String(), Type.Null()]),
    passportNumber: Type.Union([Type.String(), Type.Null()]),
    photoUrl: Type.Union([Type.String(), Type.Null()]),
    address: Type.Union([Type.String(), Type.Null()]),
    regionCode: Type.Union([Type.String(), Type.Null()]),
    districtCode: Type.Union([Type.String(), Type.Null()]),
    docType: Type.Union([Type.Integer(), Type.Null()]),
  });

  const SessionTokens = Type.Object({
    accessToken: Type.String(),
    sessionToken: Type.String(),
  });

  const Ok = Type.Object({ ok: Type.Boolean() }, { examples: [{ ok: true }] });

  const Platform = Type.Union([Type.Literal('ios'), Type.Literal('android')], {
    examples: ['ios'],
  });

  /* ── Setup (finish onboarding: PIN + trusted device + session) ───────────── */

  fastify.post(
    '/setup',
    {
      schema: {
        tags: TAGS,
        summary: 'Finish onboarding',
        description:
          'Consumes the regToken from myid-complete: sets the account PIN, marks ' +
          'this device (x-device-id) trusted, and mints the first active ' +
          'user_device session. Returns the access + durable session tokens.',
        body: Type.Object({
          regToken: Type.String({ minLength: 1, examples: ['ey...'] }),
          pin: Pin,
          platform: Platform,
          appVersion: Type.String({ minLength: 1, maxLength: 10, examples: ['1.0.0'] }),
        }),
        response: {
          200: Type.Object({
            accessToken: Type.String(),
            sessionToken: Type.String(),
            client: ClientDto,
          }),
          400: ERROR,
        },
      },
    },
    async (request, reply) => {
      let payload: RegTokenSetup;
      try {
        payload = app.jwt.verify<RegTokenSetup>(request.body.regToken);
      } catch {
        return reply.code(400).sendError('invalid_reg_token');
      }
      if (payload.step !== 'identity_verified') return reply.code(400).sendError('invalid_step');
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');

      const userId = Number(payload.sub);
      const user = await findUserById(userId);
      if (!user) return reply.code(400).sendError('user_not_found');

      await setUserPin(userId, request.body.pin);
      const deviceRowId = await activateDevice({
        userId,
        deviceId: request.deviceId,
        platform: request.body.platform,
        appVersion: request.body.appVersion,
      });
      // One active session per device: drop any prior session on this device
      // (e.g. it changed hands) before minting the new one.
      await revokeDeviceSessions(deviceRowId);

      const accessToken = app.jwt.sign(
        { sub: user.id.toString(), type: 'client' },
        { expiresIn: ACCESS_TOKEN_TTL },
      );
      const { sessionToken } = await createSession(user.id, deviceRowId);

      return { accessToken, sessionToken, client: toClientDto(user) };
    },
  );

  /* ── Set / change PIN ────────────────────────────────────────────────────── */

  fastify.post(
    '/pin',
    {
      schema: {
        tags: TAGS,
        summary: 'Set or change PIN',
        description:
          'Sets (or changes) the authenticated client’s 4-digit app PIN. Called ' +
          'right after registration onboarding, and again to change the PIN later.',
        security: SECURITY,
        body: Type.Object({ pin: Pin }),
        response: { 200: Ok, 401: ERROR },
      },
      preHandler: [app.verifyClientJwt],
    },
    async (request) => {
      await setUserPin(Number(request.user.sub), request.body.pin);
      return { ok: true };
    },
  );

  /* ── PIN login ───────────────────────────────────────────────────────────── */

  fastify.post(
    '/login/pin',
    {
      schema: {
        tags: TAGS,
        summary: 'Log in with PIN',
        description:
          'Verifies the account PIN for the given phone on an already-trusted ' +
          'device (activated via /setup) and mints a fresh access + session token. ' +
          'An unknown device is rejected — it must complete OTP + MyID + /setup. ' +
          `Locks after ${PIN_MAX_ATTEMPTS} consecutive wrong PINs until a full re-auth.`,
        body: Type.Object({
          phone: Type.String({ minLength: 12, maxLength: 12, examples: ['998991234567'] }),
          pin: Pin,
        }),
        response: {
          200: Type.Object({
            accessToken: Type.String(),
            sessionToken: Type.String(),
            client: ClientDto,
          }),
          400: ERROR,
          409: ERROR,
          423: ERROR,
        },
      },
    },
    async (request, reply) => {
      const { phone, pin } = request.body;
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');

      const failKey = pinFailKey(phone);
      const fails = Number((await redis.get(failKey).catch(() => null)) ?? 0);
      if (fails >= PIN_MAX_ATTEMPTS) return reply.code(423).sendError('pin_locked');

      const user = await findUserByPhone(phone);
      if (!user) return reply.code(400).sendError('no_account');
      if (!user.pinHash) return reply.code(400).sendError('pin_not_set');

      // Trusted-device gate: this device must have been activated for THIS user.
      const device = await findDeviceByDeviceId(request.deviceId);
      if (!device || device.userId !== user.id || !device.activatedAt) {
        return reply.code(409).sendError('device_not_registered');
      }

      const ok = await verifyUserPin(user, pin);
      if (!ok) {
        // Atomic increment; stamp the backstop TTL on the first failure only.
        const count = await redis.incr(failKey).catch(() => 0);
        if (count === 1) await redis.expire(failKey, PIN_LOCK_TTL).catch(() => undefined);
        if (count >= PIN_MAX_ATTEMPTS) return reply.code(423).sendError('pin_locked');
        return reply.code(400).sendError('invalid_pin');
      }

      // Success clears the failure counter.
      await redis.del(failKey).catch(() => undefined);

      // One active session per device — supersede the device's prior session.
      await revokeDeviceSessions(device.id);

      const accessToken = app.jwt.sign(
        { sub: user.id.toString(), type: 'client' },
        { expiresIn: ACCESS_TOKEN_TTL },
      );
      const { sessionToken } = await createSession(user.id, device.id);

      return { accessToken, sessionToken, client: toClientDto(user) };
    },
  );

  /* ── Session exchange (biometric login + silent refresh) ─────────────────── */

  fastify.post(
    '/session',
    {
      schema: {
        tags: TAGS,
        summary: 'Exchange session token',
        description:
          'Exchanges a durable session token for a fresh access token, rotating the ' +
          'session token. Backs both biometric login (unlock Keychain → call this) ' +
          'and the silent access-token refresh. Pinned to the session’s device: the ' +
          'x-device-id must match, so a leaked token cannot be replayed elsewhere.',
        body: Type.Object({
          sessionToken: Type.String({ minLength: 1, examples: ['sess_4b8e1d0a9c'] }),
        }),
        response: { 200: SessionTokens, 401: ERROR },
      },
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(401).sendError('invalid_session');
      const rotated = await rotateSession(request.body.sessionToken, request.deviceId);
      if (!rotated) return reply.code(401).sendError('invalid_session');

      const accessToken = app.jwt.sign(
        { sub: rotated.user.id.toString(), type: 'client' },
        { expiresIn: ACCESS_TOKEN_TTL },
      );
      return { accessToken, sessionToken: rotated.sessionToken };
    },
  );

  /* ── Logout (this device) ────────────────────────────────────────────────── */

  fastify.post(
    '/logout',
    {
      schema: {
        tags: TAGS,
        summary: 'Log out',
        description:
          'Revokes the given session token. The client also wipes its stored access ' +
          'and session tokens. The PIN is left intact — the user can return via PIN login.',
        security: SECURITY,
        body: Type.Object({
          sessionToken: Type.String({ minLength: 1, examples: ['sess_4b8e1d0a9c'] }),
        }),
        response: { 200: Ok, 401: ERROR },
      },
      preHandler: [app.verifyClientJwt],
    },
    async (request) => {
      await revokeSession(request.body.sessionToken);
      return { ok: true };
    },
  );
}
