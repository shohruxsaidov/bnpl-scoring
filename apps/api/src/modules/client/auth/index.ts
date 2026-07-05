import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { redis } from '@redis';
import { users } from '@db/schema';
import {
  activateDevice,
  clearDeviceKey,
  consumeBiometricChallenge,
  createBiometricChallenge,
  createSession,
  findDeviceByDeviceId,
  findUserById,
  registerDeviceKey,
  revokeDeviceSessions,
  revokeSession,
  setUserPin,
  verifyBiometricSignature,
  verifyUserPin,
} from '../../auth/client/service/service.handler';

// Onboarding token minted by registration/myid-complete. Carries no `type`
// field, so it cannot pass verifyClientJwt as an access token; only /setup
// accepts it.
interface RegTokenSetup {
  sub: string;
  step: 'identity_verified';
}

// Client app re-auth: finish onboarding (/setup) and logout.

const ERROR = { $ref: 'ErrorResponse#' };
const SECURITY = [{ clientAuth: [] }];

const ACCESS_TOKEN_TTL = '15m';

// Consecutive failed PIN attempts (keyed by phone/account, not device, so an
// attacker can't reset the counter by hopping devices) before the account is
// locked. Recovery is a full OTP + MyID re-auth, which clears the counter.
const MAX_PIN_FAILS = 5;

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

  /* ── PIN login (re-establish a session on a trusted device) ──────────────── */

  fastify.post(
    '/login',
    {
      schema: {
        tags: TAGS,
        summary: 'Log in with PIN',
        description:
          'Re-establishes a session on a trusted device (one that completed ' +
          '/setup) using the account PIN. Identity is resolved from x-device-id, ' +
          'so no phone entry is needed. Backs the fallback path when the durable ' +
          'session token is gone (post-logout or expired) and biometric can no ' +
          'longer help. After MAX_PIN_FAILS consecutive wrong PINs the account is ' +
          'locked; recovery is a full OTP + MyID re-auth.',
        body: Type.Object({ pin: Pin }),
        response: {
          200: Type.Object({
            accessToken: Type.String(),
            sessionToken: Type.String(),
            client: ClientDto,
          }),
          400: ERROR,
          401: ERROR,
          403: ERROR,
        },
      },
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');

      const device = await findDeviceByDeviceId(request.deviceId);
      if (!device || !device.activatedAt) return reply.code(400).sendError('device_not_trusted');

      const user = await findUserById(device.userId);
      if (!user) return reply.code(400).sendError('device_not_trusted');

      const failKey = pinFailKey(user.phone);
      const fails = Number((await redis.get(failKey).catch(() => null)) ?? 0);
      if (fails >= MAX_PIN_FAILS) return reply.code(403).sendError('account_locked');

      const ok = await verifyUserPin(user, request.body.pin);
      if (!ok) {
        await redis.incr(failKey).catch(() => undefined);
        return reply.code(401).sendError('invalid_pin');
      }

      // Correct PIN: clear the counter and mint a fresh device-bound session.
      await redis.del(failKey).catch(() => undefined);
      // One active session per device: drop any stale session before the new one.
      await revokeDeviceSessions(device.id);

      const accessToken = app.jwt.sign(
        { sub: user.id.toString(), type: 'client' },
        { expiresIn: ACCESS_TOKEN_TTL },
      );
      const { sessionToken } = await createSession(user.id, device.id);

      return { accessToken, sessionToken, client: toClientDto(user) };
    },
  );

  /* ── Biometric enrolment (register / disable the device keypair) ─────────── */

  fastify.post(
    '/register-device',
    {
      schema: {
        tags: TAGS,
        summary: 'Enrol biometric key',
        description:
          'Registers the device (x-device-id) biometric public key for a logged-in ' +
          'user. The device must already be trusted (completed /setup) and owned by ' +
          'the caller. The key is a base64 SPKI-DER ES256 (P-256) public key whose ' +
          'private half lives in the Secure Enclave / Keystore. Re-enrolling ' +
          'overwrites the prior key. Enables biometric login via /challenge + /biometric.',
        security: SECURITY,
        body: Type.Object({
          publicKey: Type.String({ minLength: 1, examples: ['MFkwEwYHKoZIzj0CAQYI...'] }),
        }),
        response: { 200: Ok, 400: ERROR, 401: ERROR },
      },
      preHandler: [app.verifyClientJwt],
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');

      const device = await findDeviceByDeviceId(request.deviceId);
      if (!device || !device.activatedAt) return reply.code(400).sendError('device_not_trusted');
      // The key may only be enrolled for the device's own owner — never let one
      // user's access token attach a key to another user's device.
      if (device.userId !== Number(request.user.sub)) {
        return reply.code(400).sendError('device_not_trusted');
      }

      const ok = await registerDeviceKey(device.id, request.body.publicKey);
      if (!ok) return reply.code(400).sendError('invalid_public_key');

      return { ok: true };
    },
  );

  fastify.delete(
    '/register-device',
    {
      schema: {
        tags: TAGS,
        summary: 'Disable biometric key',
        description:
          'Removes this device (x-device-id) biometric public key, disabling ' +
          'biometric login. PIN login is unaffected. Idempotent.',
        security: SECURITY,
        response: { 200: Ok, 400: ERROR, 401: ERROR },
      },
      preHandler: [app.verifyClientJwt],
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');

      const device = await findDeviceByDeviceId(request.deviceId);
      if (!device || device.userId !== Number(request.user.sub)) {
        return reply.code(400).sendError('device_not_trusted');
      }

      await clearDeviceKey(device.id);
      return { ok: true };
    },
  );

  /* ── Biometric challenge (one-time nonce to sign) ────────────────────────── */

  fastify.post(
    '/challenge',
    {
      schema: {
        tags: TAGS,
        summary: 'Request biometric challenge',
        description:
          'Mints a single-use challenge for this device (x-device-id) to sign with ' +
          'its biometric private key. Unauthenticated by design — the signature IS ' +
          'the credential. The challenge is bound to this device and expires within ' +
          '120 seconds; each is valid for exactly one /biometric attempt.',
        response: {
          200: Type.Object({
            challengeId: Type.String(),
            challenge: Type.String(),
          }),
          400: ERROR,
        },
      },
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');
      return createBiometricChallenge(request.deviceId);
    },
  );

  /* ── Biometric login (prove key possession → session) ────────────────────── */

  fastify.post(
    '/biometric',
    {
      schema: {
        tags: TAGS,
        summary: 'Log in with biometric',
        description:
          'Re-establishes a session on a trusted device by proving possession of the ' +
          'biometric private key: the client signs the challenge from /challenge and ' +
          'submits the DER (X9.62) ECDSA signature, base64-encoded. The challenge is ' +
          'consumed on use (single-use). On success, mirrors /login — mints a fresh ' +
          'access + durable session token. A 401 means the challenge is spent/expired, ' +
          'the device is not enrolled, or the signature does not verify; the client ' +
          'falls back to PIN login.',
        body: Type.Object({
          challengeId: Type.String({ minLength: 1, examples: ['uuid'] }),
          signature: Type.String({ minLength: 1, examples: ['MEUCIQ...'] }),
        }),
        response: {
          200: Type.Object({
            accessToken: Type.String(),
            sessionToken: Type.String(),
            client: ClientDto,
          }),
          401: ERROR,
        },
      },
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(401).sendError('invalid_challenge');

      // Single-use: spend the challenge up front, so a bad signature cannot be
      // retried against the same nonce.
      const pending = await consumeBiometricChallenge(request.body.challengeId);
      if (!pending || pending.deviceId !== request.deviceId) {
        return reply.code(401).sendError('invalid_challenge');
      }

      const device = await findDeviceByDeviceId(request.deviceId);
      if (!device || !device.activatedAt || !device.publicKey) {
        return reply.code(401).sendError('device_not_enrolled');
      }

      const user = await findUserById(device.userId);
      if (!user) return reply.code(401).sendError('device_not_enrolled');

      const ok = verifyBiometricSignature(
        device.publicKey,
        pending.challenge,
        request.body.signature,
      );
      if (!ok) return reply.code(401).sendError('invalid_signature');

      // One active session per device: drop any stale session before the new one.
      await revokeDeviceSessions(device.id);

      const accessToken = app.jwt.sign(
        { sub: user.id.toString(), type: 'client' },
        { expiresIn: ACCESS_TOKEN_TTL },
      );
      const { sessionToken } = await createSession(user.id, device.id);

      return { accessToken, sessionToken, client: toClientDto(user) };
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
