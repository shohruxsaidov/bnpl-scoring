import { randomUUID } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { redis } from '@redis';
import { env } from '@env';
import { users } from '@db/schema';
import {
  activateDevice,
  clearAllUserDeviceKeys,
  clearDeviceKey,
  consumeBiometricChallenge,
  createBiometricChallenge,
  createOtp,
  createSession,
  deleteOtps,
  findDeviceByDeviceId,
  findUserById,
  findUserByPhone,
  refreshAccessToken,
  registerDeviceKey,
  revokeAllUserSessions,
  revokeDeviceSessions,
  revokeSession,
  revokeUserSessionsExcept,
  setUserPassword,
  setUserPin,
  upsertDevice,
  verifyBiometricSignature,
  verifyOtp,
  verifyUserPassword,
  verifyUserPin,
} from '../../auth/client/service/service.handler';
import type { OtpPurpose } from '../../auth/client/service/service.handler';
import { sendOtpSms } from '../../../lib/sms';

// Onboarding token minted by registration/myid-complete. Carries no `type`
// field, so it cannot pass verifyClientJwt as an access token; only /setup
// accepts it.
interface RegTokenSetup {
  sub: string;
  step: 'identity_verified';
  // Device that completed MyID. Absent on tokens minted before device binding
  // shipped; those stay valid until they expire (REG_TOKEN_TTL, 15m).
  deviceId?: string;
}

// Minted by /forgot-password/verify once the reset OTP is consumed, redeemed by
// /reset-password. `step` is what keeps it from being interchangeable with the
// registration tokens — every token in this API is signed with the same
// JWT_SECRET, so a bare { phone } payload would be replayable across flows. It
// carries no `type`, so it cannot pass verifyClientJwt as an access token.
interface ResetToken {
  phone: string;
  step: 'password_reset_verified';
  // The device that verified the OTP. /reset-password activates request.deviceId
  // and mints a session on it, so an unbound token could be redeemed straight
  // into a session on an attacker's device.
  deviceId: string;
  // Single-use marker; must match the jti held in Redis under resetTokenKey.
  jti: string;
}

// Minted by /forgot-pin/verify once the reset OTP is consumed, redeemed by
// /pin-reset. Structurally identical to ResetToken, but `step` differs and that
// is the only thing keeping the two apart: both are signed with the same
// JWT_SECRET, so without it a password-reset token would be redeemable at
// /pin-reset (and vice versa). Carries no `type`, so it cannot pass
// verifyClientJwt as an access token.
interface PinResetToken {
  phone: string;
  step: 'pin_reset_verified';
  // The device that verified the OTP. /pin-reset mints a session on it, so an
  // unbound token could be redeemed straight into a session on another device.
  deviceId: string;
  // Single-use marker; must match the jti held in Redis under pinResetTokenKey.
  jti: string;
}

// Client app re-auth: finish onboarding (/setup) and logout.

const ERROR = { $ref: 'ErrorResponse#' };
const SECURITY = [{ clientAuth: [] }];

const ACCESS_TOKEN_TTL = '15m';

// Consecutive failed PIN attempts (keyed by phone/account, not device, so an
// attacker can't reset the counter by hopping devices) before the account is
// locked. Recovery is a full OTP + MyID re-auth, which clears the counter.
const MAX_PIN_FAILS = 5;

// Consecutive failed password attempts (keyed by phone, independent of the PIN
// counter) before password login demands an OTP step-up even on a trusted
// device. A successful OTP-backed login clears it.
const MAX_PASSWORD_FAILS = 5;

// OTP throttle (shared Redis keys with the registration flow so one phone can't
// be flooded across purposes). Mirrors client/registration.
const OTP_COOLDOWN_SECONDS = 60;
//TODO need to change to 10
const OTP_DAILY_LIMIT = 100;
const OTP_DAILY_TTL = 24 * 60 * 60;

// Lifetime of an OTP row, mirroring createOtp. Used only to bound the guess
// counter to the code it guards.
const OTP_TTL_SECONDS = 5 * 60;

// Guesses allowed against a single reset OTP before it is burned. /forgot-
// password/verify exists only to answer "is this code right?", which makes it a
// clean oracle against a 4-digit (10k) space; the global limiter is in-memory
// and therefore per-process, so it cannot be the bound. Spending the budget
// deletes the code — a caller who merely waited out a rate-limit window would
// otherwise resume against the same live OTP. A resend mints a new code and
// clears this counter: the daily cap (10) is what bounds brute force across
// codes, so refusing a legitimate re-try after a mistyped code buys nothing.
const MAX_OTP_ATTEMPTS = 5;

// Window for redeeming a reset token — one password-entry screen. Deliberately
// shorter than REG_TOKEN_TTL (15m), which is sized for a MyID identity check.
const RESET_TOKEN_TTL = '5m';
const RESET_TOKEN_TTL_SECONDS = 5 * 60;

/** Redis key holding the consecutive failed-PIN count for a phone. */
export function pinFailKey(phone: string): string {
  return `client:pin:fails:${phone}`;
}

/** Redis key holding the consecutive failed-password count for a phone. */
export function passwordFailKey(phone: string): string {
  return `client:password:fails:${phone}`;
}

/**
 * Redis key holding the guess count against the live OTP for a phone+purpose.
 * Keyed by purpose so the password-reset and PIN-reset budgets are independent:
 * they guard different codes (deleteOtps is per-purpose, so both can be live at
 * once) and spending one must not lock the user out of the other.
 */
function otpAttemptKey(phone: string, purpose: OtpPurpose): string {
  return `client:otp:attempts:${purpose}:${phone}`;
}

/**
 * Redis key holding the jti of the phone's current reset token. One key per
 * phone (not per token) so it does double duty: /reset-password fetch-and-
 * deletes it to make redemption single-use, and issuing a fresh OTP deletes it,
 * which supersedes any token minted from a code the user has since replaced.
 */
function resetTokenKey(phone: string): string {
  return `client:reset:token:${phone}`;
}

/** As resetTokenKey, for the PIN-reset flow. Separate key: the two flows run
 * independently, so a fresh PIN-reset OTP must not supersede a live password-
 * reset token. */
function pinResetTokenKey(phone: string): string {
  return `client:pin-reset:token:${phone}`;
}

// Flat result (this project builds without strictNullChecks, so a discriminated
// union wouldn't narrow): `error` set means throttled, otherwise `code` is the
// issued OTP.
interface IssueOtpResult {
  code?: string;
  error?: 'cooldown' | 'daily';
  seconds?: number;
}

/**
 * Enforce the per-phone cooldown + daily cap, then mint and SMS an OTP for the
 * given purpose. Returns the code on success (callers surface it as `devOtp` in
 * non-prod) or a throttle `error` for the caller to translate to 429.
 */
async function issueOtp(phone: string, purpose: OtpPurpose): Promise<IssueOtpResult> {
  const cooldownKey = `client:otp:cooldown:${phone}`;
  const onCooldown = await redis.get(cooldownKey).catch(() => null);
  if (onCooldown) {
    const ttl = await redis.ttl(cooldownKey).catch(() => OTP_COOLDOWN_SECONDS);
    return { error: 'cooldown', seconds: ttl > 0 ? ttl : OTP_COOLDOWN_SECONDS };
  }

  const dailyKey = `client:otp:daily:${phone}`;
  const count = await redis.incr(dailyKey).catch(() => 0);
  if (count === 1) await redis.expire(dailyKey, OTP_DAILY_TTL).catch(() => undefined);
  if (count > OTP_DAILY_LIMIT) return { error: 'daily' };

  const code = await createOtp(phone, purpose);
  await redis.set(cooldownKey, '1', 'EX', OTP_COOLDOWN_SECONDS).catch(() => undefined);
  await sendOtpSms(phone, code);
  return { code };
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

  const isProd = env.NODE_ENV === 'production';

  const Pin = Type.String({
    minLength: 4,
    maxLength: 4,
    pattern: '^\\d{4}$',
    examples: ['1234'],
  });

  // Portable account password: 6–128 chars, at least one letter and one digit.
  const Password = Type.String({
    minLength: 6,
    maxLength: 128,
    pattern: '^(?=.*[A-Za-z])(?=.*\\d).{6,128}$',
    examples: ['pass12'],
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

  const Ok = Type.Object(
    {
      ok: Type.Boolean(),
    },
    { examples: [{ ok: true }] },
  );

  const Platform = Type.Union([Type.Literal('ios'), Type.Literal('android')], {
    examples: ['ios'],
  });

  // Base64 SPKI-DER of an ES256 (P-256) public key — ~124 chars in practice. The
  // upper bound keeps an authenticated caller from writing an arbitrarily large
  // blob into user_devices.public_key (an unbounded `text` column).
  const PublicKey = Type.String({
    minLength: 1,
    maxLength: 512,
    examples: ['MFkwEwYHKoZIzj0CAQYI...'],
  });

  /**
   * Enrol an optional biometric key on a just-activated device. MUST run after
   * activateDevice, which nulls publicKey on conflict — enrolling first would be
   * silently undone. A malformed key never fails the caller: biometric is a
   * convenience credential with PIN and password as fallbacks, and the flows
   * calling this have already committed a password and a trusted device. The
   * outcome is reported to the app as `biometricEnrolled` so it can re-prompt
   * against POST /register-device with the access token it just received.
   */
  async function enrollKeyIfProvided(deviceRowId: string, publicKey?: string): Promise<boolean> {
    if (!publicKey) return false;
    return registerDeviceKey(deviceRowId, publicKey);
  }

  /* ── Setup (finish onboarding: PIN + trusted device + session) ───────────── */

  fastify.post(
    '/setup',
    {
      schema: {
        tags: TAGS,
        summary: 'Finish onboarding',
        body: Type.Object({
          regToken: Type.String({ minLength: 1, examples: ['ey...'] }),
          password: Password,
          pin: Type.Optional(Pin),
          platform: Platform,
          appVersion: Type.String({ minLength: 1, maxLength: 10, examples: ['1.0.0'] }),
          publicKey: Type.Optional(PublicKey),
        }),
        response: {
          200: Type.Object({
            accessToken: Type.String(),
            sessionToken: Type.String(),
            client: ClientDto,
            biometricEnrolled: Type.Boolean(),
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
      // The token is bound to the device that finished MyID. Tokens minted before
      // binding shipped carry no deviceId; accept those until they age out, then
      // make this check unconditional.
      if (payload.deviceId && payload.deviceId !== request.deviceId) {
        return reply.code(400).sendError('invalid_reg_token');
      }

      const userId = Number(payload.sub);
      const user = await findUserById(userId);
      if (!user) return reply.code(400).sendError('user_not_found');

      await setUserPassword(userId, request.body.password);
      // PIN is an optional on-device convenience; only set it when supplied.
      if (request.body.pin) await setUserPin(userId, request.body.pin);
      const deviceRowId = await activateDevice({
        userId,
        deviceId: request.deviceId,
        platform: request.body.platform,
        appVersion: request.body.appVersion,
      });
      // One active session per device: drop any prior session on this device
      // (e.g. it changed hands) before minting the new one.
      await revokeDeviceSessions(deviceRowId);
      const biometricEnrolled = await enrollKeyIfProvided(deviceRowId, request.body.publicKey);

      const accessToken = app.jwt.sign(
        { sub: user.id.toString(), type: 'client' },
        { expiresIn: ACCESS_TOKEN_TTL },
      );
      const { sessionToken } = await createSession(user.id, deviceRowId);

      return { accessToken, sessionToken, client: toClientDto(user), biometricEnrolled };
    },
  );

  /* ── Password login (primary; portable across devices) ───────────────────── */
  //
  // Single call: { phone, password }. Verify the password, trust the device
  // (activate it so PIN/biometric can be enrolled later), and mint a session —
  // on any device, no OTP. A per-phone counter locks the account after
  // MAX_PASSWORD_FAILS wrong attempts; recovery is /forgot-password, which
  // clears the counter.
  fastify.post(
    '/login',
    {
      schema: {
        tags: TAGS,
        summary: 'Log in with password',
        body: Type.Object({
          phone: Type.String({ minLength: 1, maxLength: 20, examples: ['998901234567'] }),
          password: Password,
          platform: Platform,
          appVersion: Type.String({ minLength: 1, maxLength: 10, examples: ['1.0.0'] }),
          publicKey: Type.Optional(PublicKey),
        }),
        response: {
          200: Type.Object({
            accessToken: Type.String(),
            sessionToken: Type.String(),
            client: ClientDto,
            biometricEnrolled: Type.Boolean(),
          }),
          400: ERROR,
          401: ERROR,
          403: ERROR, // account_locked
        },
      },
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');

      const { phone, password, platform, appVersion, publicKey } = request.body;

      const user = await findUserByPhone(phone);
      // Uniform 401 whether the user is unknown or the password is wrong, so the
      // endpoint doesn't confirm which phones have accounts.
      if (!user) return reply.code(401).sendError('invalid_credentials');

      const failKey = passwordFailKey(phone);
      const fails = Number((await redis.get(failKey).catch(() => null)) ?? 0);
      if (fails >= MAX_PASSWORD_FAILS) return reply.code(403).sendError('account_locked');

      const ok = await verifyUserPassword(user, password);
      if (!ok) {
        await redis.incr(failKey).catch(() => undefined);
        return reply.code(401).sendError('invalid_credentials');
      }

      // Correct password: clear the counter, trust this device, mint a session.
      await redis.del(failKey).catch(() => undefined);
      const deviceRowId = await activateDevice({
        userId: user.id,
        deviceId: request.deviceId,
        platform,
        appVersion,
      });
      // One active session per device: drop any stale session before the new one.
      await revokeDeviceSessions(deviceRowId);
      // activateDevice above nulled any prior key, so a returning user who logs
      // in by password loses biometric unless the app re-enrols here.
      const biometricEnrolled = await enrollKeyIfProvided(deviceRowId, publicKey);

      const accessToken = app.jwt.sign(
        { sub: user.id.toString(), type: 'client' },
        { expiresIn: ACCESS_TOKEN_TTL },
      );
      const { sessionToken } = await createSession(user.id, deviceRowId);
      return { accessToken, sessionToken, client: toClientDto(user), biometricEnrolled };
    },
  );

  /* ── PIN login (re-establish a session on a trusted device) ──────────────── */

  fastify.post(
    '/login/pin',
    {
      schema: {
        tags: TAGS,
        summary: 'Log in with PIN',
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

  /* ── Forgot password (request reset OTP) ─────────────────────────────────── */

  fastify.post(
    '/forgot-password',
    {
      config: {
        rateLimit: {
          max: 2,
          timeWindow: 60 * 1000,
          keyGenerator: (req) => {
            return `client-forgot-password:${req.headers['x-device-id'] || ''}:${req.ip}`;
          },
        },
      },
      schema: {
        tags: TAGS,
        summary: 'Request a password-reset OTP',
        body: Type.Object({
          phone: Type.String({ minLength: 1, maxLength: 20, examples: ['998901234567'] }),
        }),
        response: {
          200: Type.Object(
            {
              ok: Type.Boolean(),
              devOtp: Type.Optional(Type.String()),
            },
            { examples: [{ ok: true }] },
          ),
          404: ERROR,
          429: ERROR,
        },
      },
    },
    async (request, reply) => {
      const { phone } = request.body;
      const user = await findUserByPhone(phone);
      if (!user) return reply.code(404).sendError('user_not_found');

      const issued = await issueOtp(phone, 'password_reset');
      if (issued.error === 'cooldown') {
        return reply.code(429).sendError('otp_cooldown', { seconds: issued.seconds });
      }
      if (issued.error === 'daily') return reply.code(429).sendError('otp_daily_limit');

      // The previous code is dead (createOtp deleted it), so anything derived
      // from it must die with it: the guess budget resets for the new code, and
      // a reset token already minted from the old one stops being redeemable.
      await redis
        .del(otpAttemptKey(phone, 'password_reset'), resetTokenKey(phone))
        .catch(() => undefined);

      if (!isProd) request.log.info({ phone, code: issued.code }, 'client password reset OTP');
      return { ok: true, ...(isProd ? {} : { devOtp: issued.code }) };
    },
  );

  /* ── Forgot password · verify OTP (→ reset token) ─────────────────────────── */
  //
  // Consumes the reset OTP and hands back a short-lived token that /reset-
  // password redeems. Splitting verification from the password change means the
  // user learns the code was wrong before typing a new password — but it also
  // makes this a pure oracle against a 4-digit code, hence the attempt budget.
  fastify.post(
    '/forgot-password/verify',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: 60 * 1000,
          keyGenerator: (req) => {
            return `client-forgot-password-verify:${req.headers['x-device-id'] || ''}:${req.ip}`;
          },
        },
      },
      schema: {
        tags: TAGS,
        summary: 'Verify a password-reset OTP',
        body: Type.Object({
          phone: Type.String({ minLength: 1, maxLength: 20, examples: ['998901234567'] }),
          otp: Type.String({ minLength: 4, maxLength: 10, examples: ['1234'] }),
        }),
        response: {
          200: Type.Object({ resetToken: Type.String() }),
          400: ERROR,
          401: ERROR,
          404: ERROR,
          429: ERROR,
        },
      },
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');

      const { phone, otp } = request.body;
      const user = await findUserByPhone(phone);
      if (!user) return reply.code(404).sendError('user_not_found');

      const attemptKey = otpAttemptKey(phone, 'password_reset');
      const attempts = Number((await redis.get(attemptKey).catch(() => null)) ?? 0);
      if (attempts >= MAX_OTP_ATTEMPTS) {
        return reply.code(429).sendError('otp_attempts_exceeded');
      }

      if (!(await verifyOtp(phone, otp, 'password_reset'))) {
        const spent = await redis.incr(attemptKey).catch(() => 0);
        // Bound the counter to the OTP's own lifetime. Without this it would
        // outlive the code it guards (as pinFailKey/passwordFailKey do today)
        // and lock the phone out of a future reset it never attempted.
        if (spent === 1) await redis.expire(attemptKey, OTP_TTL_SECONDS).catch(() => undefined);
        if (spent >= MAX_OTP_ATTEMPTS) {
          await deleteOtps(phone, 'password_reset');
          return reply.code(429).sendError('otp_attempts_exceeded');
        }
        return reply.code(401).sendError('invalid_otp');
      }

      await redis.del(attemptKey).catch(() => undefined);

      const jti = randomUUID();
      await redis.set(resetTokenKey(phone), jti, 'EX', RESET_TOKEN_TTL_SECONDS);

      const resetToken = app.jwt.sign(
        { phone, step: 'password_reset_verified', deviceId: request.deviceId, jti },
        { expiresIn: RESET_TOKEN_TTL },
      );
      return { resetToken };
    },
  );

  /* ── Reset password (redeem reset token → new password → logged in) ──────── */
  //
  // The reset OTP already proved phone possession, so a successful reset both
  // logs the account out everywhere (an attacker who reset it inherits no live
  // session) and trusts this device + mints a session — no redundant second OTP.
  // The PIN is deliberately left standing: it can only be set at /setup, so
  // clearing it here would strand the user with no way to set a new one.
  fastify.post(
    '/reset-password',
    {
      schema: {
        tags: TAGS,
        summary: 'Reset password with a reset token',
        body: Type.Object({
          resetToken: Type.String(),
          newPassword: Password,
          platform: Platform,
          appVersion: Type.String({ minLength: 1, maxLength: 10, examples: ['1.0.0'] }),
          // Optional: the reset wipes every biometric key on the account, so the
          // app can re-enrol this device's key in the same call rather than be
          // silently de-enrolled until it notices and calls /register-device.
          publicKey: Type.Optional(PublicKey),
        }),
        response: {
          200: Type.Object({
            accessToken: Type.String(),
            sessionToken: Type.String(),
            client: ClientDto,
            biometricEnrolled: Type.Boolean(),
          }),
          400: ERROR,
          401: ERROR,
          403: ERROR,
        },
      },
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');

      const { resetToken, newPassword, platform, appVersion, publicKey } = request.body;

      let payload: ResetToken;
      try {
        payload = app.jwt.verify<ResetToken>(resetToken);
      } catch {
        return reply.code(401).sendError('invalid_reset_token');
      }
      // Every token in this API shares JWT_SECRET, so a valid signature proves
      // only that we minted it — not which flow minted it.
      if (payload.step !== 'password_reset_verified') {
        return reply.code(401).sendError('invalid_reset_token');
      }
      if (payload.deviceId !== request.deviceId) {
        return reply.code(403).sendError('reset_token_device_mismatch');
      }

      // Single-use, and superseded by any newer OTP: a mismatch means this token
      // was already redeemed or the user has since requested a fresh code.
      const storedJti = await redis.getdel(resetTokenKey(payload.phone)).catch(() => null);
      if (!storedJti || storedJti !== payload.jti) {
        return reply.code(401).sendError('invalid_reset_token');
      }

      const user = await findUserByPhone(payload.phone);
      if (!user) return reply.code(400).sendError('user_not_found');

      await setUserPassword(user.id, newPassword);
      await revokeAllUserSessions(user.id);
      // Sessions alone aren't enough: a biometric key mints fresh sessions with
      // no authentication, so a reset that left one behind would evict nobody.
      await clearAllUserDeviceKeys(user.id);
      // pinFailKey too: a password reset is strictly stronger proof than a PIN
      // reset, so it must lift a PIN lockout. Without this a user who tripped
      // MAX_PIN_FAILS follows the account_locked copy ("reset your password"),
      // completes the reset, and is still locked out of /login/pin.
      await redis
        .del(
          passwordFailKey(user.phone),
          pinFailKey(user.phone),
          otpAttemptKey(user.phone, 'password_reset'),
        )
        .catch(() => undefined);

      const deviceRowId = await activateDevice({
        userId: user.id,
        deviceId: request.deviceId,
        platform,
        appVersion,
      });
      let biometricEnrolled = false;
      if (publicKey) {
        biometricEnrolled = await enrollKeyIfProvided(deviceRowId, publicKey);
      }

      const accessToken = app.jwt.sign(
        { sub: user.id.toString(), type: 'client' },
        { expiresIn: ACCESS_TOKEN_TTL },
      );
      const { sessionToken } = await createSession(user.id, deviceRowId);
      return { accessToken, sessionToken, client: toClientDto(user), biometricEnrolled };
    },
  );

  /* ── Forgot PIN (request reset OTP) ──────────────────────────────────────── */
  //
  // Mirrors the forgot-password trio, with a deliberately narrower blast radius:
  // a PIN is a device-gated convenience credential, not the account's root one.
  // Recovering it therefore leaves other devices' sessions and every enrolled
  // biometric key standing — wiping a Secure-Enclave-backed key because the user
  // forgot four digits would trade a stronger credential for a weaker one. An
  // attacker holding the SIM gains nothing here either: they could already run
  // /forgot-password and take the account outright, which is why THAT flow
  // carries the heavy revocation and this one does not.
  //
  // Doubles as first-time PIN enrolment: the PIN is optional at /setup and there
  // is no authenticated change-PIN route, so for a user who skipped it this is
  // the only way one can ever be set. No pinHash check, by design.

  /**
   * Resolve the caller's device and assert it is trusted AND owned by `userId`.
   * The whole flow is gated on this because /login/pin (above) already refuses
   * untrusted devices: resetting a PIN where it cannot be used would accomplish
   * nothing except minting a session from an OTP — which is /forgot-password's
   * job and carries the blast radius that warrants. Gating here keeps /pin-reset
   * strictly weaker than /forgot-password, so it can't be a backdoor around it.
   * The ownership half stops one user, on their own trusted device, from
   * resetting another user's PIN given that user's OTP.
   */
  async function trustedDeviceFor(deviceId: string, userId: number) {
    const device = await findDeviceByDeviceId(deviceId);
    if (!device || !device.activatedAt || device.userId !== userId) return undefined;
    return device;
  }

  fastify.post(
    '/forgot-pin',
    {
      config: {
        rateLimit: {
          max: 2,
          timeWindow: 60 * 1000,
          keyGenerator: (req) => {
            return `client-forgot-pin:${req.headers['x-device-id'] || ''}:${req.ip}`;
          },
        },
      },
      schema: {
        tags: TAGS,
        summary: 'Request a PIN-reset OTP',
        description:
          'Sends an OTP to reset (or first set) the account PIN. Requires a trusted ' +
          'device (x-device-id) belonging to the given phone — a PIN is only usable ' +
          'on one. A user on an unknown device should log in with their password ' +
          'instead, which trusts the device.',
        body: Type.Object({
          phone: Type.String({ minLength: 1, maxLength: 20, examples: ['998901234567'] }),
        }),
        response: {
          200: Type.Object(
            {
              ok: Type.Boolean(),
              devOtp: Type.Optional(Type.String()),
            },
            { examples: [{ ok: true }] },
          ),
          400: ERROR,
          404: ERROR,
          429: ERROR,
        },
      },
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');

      const { phone } = request.body;
      const user = await findUserByPhone(phone);
      if (!user) return reply.code(404).sendError('user_not_found');

      const device = await trustedDeviceFor(request.deviceId, user.id);
      if (!device) return reply.code(400).sendError('device_not_trusted');

      const issued = await issueOtp(phone, 'pin_reset');
      if (issued.error === 'cooldown') {
        return reply.code(429).sendError('otp_cooldown', { seconds: issued.seconds });
      }
      if (issued.error === 'daily') return reply.code(429).sendError('otp_daily_limit');

      // The previous code is dead (createOtp deleted it), so anything derived
      // from it must die with it: the guess budget resets for the new code, and
      // a PIN-reset token already minted from the old one stops being redeemable.
      await redis
        .del(otpAttemptKey(phone, 'pin_reset'), pinResetTokenKey(phone))
        .catch(() => undefined);

      if (!isProd) request.log.info({ phone, code: issued.code }, 'client PIN reset OTP');
      return { ok: true, ...(isProd ? {} : { devOtp: issued.code }) };
    },
  );

  /* ── Forgot PIN · verify OTP (→ PIN reset token) ─────────────────────────── */
  //
  // As /forgot-password/verify: a pure oracle against a 4-digit code, so the
  // guess budget (not the per-process rate limiter) is what actually bounds it.
  fastify.post(
    '/forgot-pin/verify',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: 60 * 1000,
          keyGenerator: (req) => {
            return `client-forgot-pin-verify:${req.headers['x-device-id'] || ''}:${req.ip}`;
          },
        },
      },
      schema: {
        tags: TAGS,
        summary: 'Verify a PIN-reset OTP',
        body: Type.Object({
          phone: Type.String({ minLength: 1, maxLength: 20, examples: ['998901234567'] }),
          otp: Type.String({ minLength: 4, maxLength: 10, examples: ['1234'] }),
        }),
        response: {
          200: Type.Object({ pinResetToken: Type.String() }),
          400: ERROR,
          401: ERROR,
          404: ERROR,
          429: ERROR,
        },
      },
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');

      const { phone, otp } = request.body;
      const user = await findUserByPhone(phone);
      if (!user) return reply.code(404).sendError('user_not_found');

      const device = await trustedDeviceFor(request.deviceId, user.id);
      if (!device) return reply.code(400).sendError('device_not_trusted');

      const attemptKey = otpAttemptKey(phone, 'pin_reset');
      const attempts = Number((await redis.get(attemptKey).catch(() => null)) ?? 0);
      if (attempts >= MAX_OTP_ATTEMPTS) {
        return reply.code(429).sendError('otp_attempts_exceeded');
      }

      if (!(await verifyOtp(phone, otp, 'pin_reset'))) {
        const spent = await redis.incr(attemptKey).catch(() => 0);
        // Bound the counter to the OTP's own lifetime, or it would outlive the
        // code it guards and lock the phone out of a future reset it never
        // attempted.
        if (spent === 1) await redis.expire(attemptKey, OTP_TTL_SECONDS).catch(() => undefined);
        if (spent >= MAX_OTP_ATTEMPTS) {
          // Burn the code: rate-limiting the caller alone would leave it live to
          // resume against once the window rolls over.
          await deleteOtps(phone, 'pin_reset');
          return reply.code(429).sendError('otp_attempts_exceeded');
        }
        return reply.code(401).sendError('invalid_otp');
      }

      await redis.del(attemptKey).catch(() => undefined);

      const jti = randomUUID();
      await redis.set(pinResetTokenKey(phone), jti, 'EX', RESET_TOKEN_TTL_SECONDS);

      const pinResetToken = app.jwt.sign(
        { phone, step: 'pin_reset_verified', deviceId: request.deviceId, jti },
        { expiresIn: RESET_TOKEN_TTL },
      );
      return { pinResetToken };
    },
  );

  /* ── PIN reset (redeem token → new PIN → logged in) ──────────────────────── */
  //
  // Sets the PIN, lifts any PIN lockout, and mints a session on this device —
  // the response shape is /login/pin's, because that is what this is: a PIN login
  // with a PIN change on the front. Note what is absent: no activateDevice (the
  // device is already trusted, and activateDevice nulls publicKey on conflict —
  // calling it would silently de-enrol this device's biometric key), no
  // revokeAllUserSessions, no clearAllUserDeviceKeys. Only this device's own
  // stale session is dropped, to hold the one-session-per-device invariant.
  fastify.post(
    '/pin-reset',
    {
      schema: {
        tags: TAGS,
        summary: 'Reset PIN with a PIN-reset token',
        body: Type.Object({
          pinResetToken: Type.String(),
          newPin: Pin,
        }),
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

      const { pinResetToken, newPin } = request.body;

      let payload: PinResetToken;
      try {
        payload = app.jwt.verify<PinResetToken>(pinResetToken);
      } catch {
        return reply.code(401).sendError('invalid_pin_reset_token');
      }
      // Every token in this API shares JWT_SECRET, so a valid signature proves
      // only that we minted it — not which flow minted it. `step` is what stops a
      // password-reset token from being spent here.
      if (payload.step !== 'pin_reset_verified') {
        return reply.code(401).sendError('invalid_pin_reset_token');
      }
      if (payload.deviceId !== request.deviceId) {
        return reply.code(403).sendError('pin_reset_token_device_mismatch');
      }

      // Single-use, and superseded by any newer OTP: a mismatch means this token
      // was already redeemed or the user has since requested a fresh code.
      const storedJti = await redis.getdel(pinResetTokenKey(payload.phone)).catch(() => null);
      if (!storedJti || storedJti !== payload.jti) {
        return reply.code(401).sendError('invalid_pin_reset_token');
      }

      const user = await findUserByPhone(payload.phone);
      if (!user) return reply.code(400).sendError('user_not_found');

      // Re-check trust at redemption: the device could have been re-assigned to
      // another user (activateDevice on a device that changed hands) in the
      // window since the token was minted.
      const device = await trustedDeviceFor(request.deviceId, user.id);
      if (!device) return reply.code(400).sendError('device_not_trusted');

      await setUserPin(user.id, newPin);
      // The whole point of the flow: without this, a user locked out by
      // MAX_PIN_FAILS sets a new PIN and is still account_locked on /login/pin.
      await redis.del(pinFailKey(user.phone)).catch(() => undefined);

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

  /* ── Set / change password (authenticated) ───────────────────────────────── */
  //
  // First-time set (passwordHash NULL — e.g. a user onboarded before passwords
  // existed, now logged in by PIN) takes only { newPassword }. Once a password
  // exists, { currentPassword } is required. On change we log every OTHER
  // device out; pass the current { sessionToken } to keep this device signed in.
  fastify.post(
    '/password',
    {
      schema: {
        tags: TAGS,
        summary: 'Set or change password',
        security: SECURITY,
        body: Type.Object({
          currentPassword: Type.Optional(Type.String({ minLength: 1, maxLength: 128 })),
          newPassword: Password,
          sessionToken: Type.Optional(Type.String({ minLength: 1, examples: ['sess_4b8e1d0a9c'] })),
        }),
        response: { 200: Ok, 400: ERROR, 401: ERROR },
      },
      preHandler: [app.verifyClientJwt],
    },
    async (request, reply) => {
      const userId = Number(request.user.sub);
      const user = await findUserById(userId);
      if (!user) return reply.code(401).sendError('unauthorized');

      const { currentPassword, newPassword, sessionToken } = request.body;

      // A first-time set (no hash yet) is not a credential rotation — nothing is
      // being replaced, so enrolled biometric keys stay put.
      const isRotation = Boolean(user.passwordHash);

      if (isRotation) {
        if (!currentPassword) return reply.code(400).sendError('current_password_required');
        if (!(await verifyUserPassword(user, currentPassword))) {
          return reply.code(401).sendError('invalid_credentials');
        }
      }

      await setUserPassword(userId, newPassword);
      // Log out everywhere else; keep the caller's session alive when provided.
      if (sessionToken) await revokeUserSessionsExcept(userId, sessionToken);
      else await revokeAllUserSessions(userId);
      // Rotating the root credential evicts every biometric key, including this
      // device's — a key outlives sessions and would otherwise survive the change.
      if (isRotation) await clearAllUserDeviceKeys(userId);

      return { ok: true };
    },
  );

  /* ── Biometric enrolment (register / disable the device keypair) ─────────── */

  fastify.post(
    '/register-device',
    {
      schema: {
        tags: TAGS,
        summary: 'Enrol biometric key',
        security: SECURITY,
        body: Type.Object({ publicKey: PublicKey }),
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

  /* ── Refresh (durable session token → fresh access token) ────────────────── */

  fastify.post(
    '/refresh',
    {
      schema: {
        tags: TAGS,
        summary: 'Refresh access token',
        body: Type.Object({
          sessionToken: Type.String({ minLength: 1, examples: ['sess_4b8e1d0a9c'] }),
        }),
        response: {
          200: Type.Object({ accessToken: Type.String() }),
          400: ERROR,
          401: ERROR,
        },
      },
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');

      const result = await refreshAccessToken(request.body.sessionToken, request.deviceId);
      if (!result) return reply.code(401).sendError('invalid_session');

      const accessToken = app.jwt.sign(
        { sub: result.user.id.toString(), type: 'client' },
        { expiresIn: ACCESS_TOKEN_TTL },
      );

      return { accessToken };
    },
  );

  /* ── Register push token (FCM) for this device ───────────────────────────── */

  fastify.put(
    '/fcm-token',
    {
      schema: {
        tags: TAGS,
        summary: 'Register push token',
        description:
          'Upserts the FCM push token and UI language for the current device ' +
          '(x-device-id). Called after the app obtains/refreshes its FCM token. ' +
          'Language (uz|ru, default ru) drives the locale of push title/body.',
        security: SECURITY,
        body: Type.Object({
          fcmToken: Type.String({ minLength: 1, maxLength: 4096, examples: ['fMEp...:APA91b...'] }),
          platform: Platform,
          appVersion: Type.String({ minLength: 1, maxLength: 10, examples: ['1.0.0'] }),
          language: Type.Optional(
            Type.Union([Type.Literal('uz'), Type.Literal('ru')], { examples: ['ru'] }),
          ),
        }),
        response: { 200: Ok, 400: ERROR, 401: ERROR },
      },
      preHandler: [app.verifyClientJwt],
    },
    async (request, reply) => {
      if (!request.deviceId) return reply.code(400).sendError('missing_device_id');

      await upsertDevice({
        userId: Number(request.user.sub),
        deviceId: request.deviceId,
        fcmToken: request.body.fcmToken,
        platform: request.body.platform,
        appVersion: request.body.appVersion,
        language: request.body.language ?? 'ru',
      });
      return { ok: true };
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
