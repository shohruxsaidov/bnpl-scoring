import {
  createHash,
  createPublicKey,
  createVerify,
  randomBytes,
  randomInt,
  randomUUID,
} from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import argon2 from 'argon2';
import { and, eq, gt, ilike, isNull, ne, or } from 'drizzle-orm';
import { db } from '@db';
import { redis } from '@redis';
import { userDevices, userSessions, otpVerifications, users } from '@db/schema';
import { env } from '../../../../env';

export type OtpPurpose =
  | 'login'
  | 'register'
  | 'client_registration'
  | 'deal_signing'
  | 'password_reset'
  | 'pin_reset';

/** Hash a raw token with SHA-256, hex-encoded. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Generate a random 4-digit OTP string (zero-padded). */
export function generateOtp(): string {
  return String(randomInt(0, 10000)).padStart(4, '0');
}

/**
 * Drop every live (unused) OTP for a phone+purpose. Called before issuing a
 * fresh code, and to burn the outstanding code once its guess budget is spent —
 * rate-limiting the caller alone would leave the code alive for an attacker to
 * resume against after the window rolls over.
 */
export async function deleteOtps(phone: string, purpose: OtpPurpose): Promise<void> {
  await db
    .delete(otpVerifications)
    .where(
      and(
        eq(otpVerifications.phone, phone),
        eq(otpVerifications.purpose, purpose),
        isNull(otpVerifications.usedAt),
      ),
    );
}

/**
 * Delete any existing unused OTPs for the same phone+purpose, then insert a
 * fresh code valid for 5 minutes. Returns the generated code.
 */
export async function createOtp(phone: string, purpose: OtpPurpose): Promise<string> {
  await deleteOtps(phone, purpose);

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  await db.insert(otpVerifications).values({ phone, code, purpose, expiresAt });

  return code;
}

/**
 * Find a matching, unexpired, unused OTP. On match, mark it used and return
 * true; otherwise return false.
 */
export async function verifyOtp(
  phone: string,
  code: string,
  purpose: OtpPurpose,
): Promise<boolean> {
  const [row] = await db
    .select()
    .from(otpVerifications)
    .where(
      and(
        eq(otpVerifications.phone, phone),
        eq(otpVerifications.code, code),
        eq(otpVerifications.purpose, purpose),
        isNull(otpVerifications.usedAt),
        gt(otpVerifications.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) return false;

  await db
    .update(otpVerifications)
    .set({ usedAt: new Date() })
    .where(eq(otpVerifications.id, row.id));

  return true;
}

export async function findUserByPhone(phone: string) {
  const [row] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  return row;
}

export async function findUserById(id: number) {
  const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return row;
}

export async function searchUsers(q: string, limit = 20) {
  const term = `%${q}%`;
  return db
    .select()
    .from(users)
    .where(or(ilike(users.firstName, term), ilike(users.lastName, term), ilike(users.pinfl, term)))
    .limit(limit);
}

export async function findUserByPinfl(pinfl: string) {
  const [row] = await db.select().from(users).where(eq(users.pinfl, pinfl)).limit(1);
  return row;
}

/**
 * Create a device-bound session for a user. Generates a random opaque token,
 * stores only its hash, and returns the raw token to be kept by the client.
 * `deviceId` is the owning user_devices.id (uuid).
 */
export async function createSession(
  userId: number,
  deviceId: string,
): Promise<{ sessionId: string; sessionToken: string }> {
  const sessionToken = randomUUID() + randomBytes(16).toString('hex');
  const sessionTokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + env.SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  const [row] = await db
    .insert(userSessions)
    .values({ userId, deviceId, sessionTokenHash, expiresAt })
    .returning({ id: userSessions.id });

  return { sessionId: row!.id, sessionToken };
}

/**
 * Resolve a raw session token to its session + user, provided the session is
 * unexpired and not revoked. Returns undefined when invalid.
 */
export async function verifySession(sessionToken: string) {
  const sessionTokenHash = hashToken(sessionToken);

  const [session] = await db
    .select()
    .from(userSessions)
    .where(
      and(
        eq(userSessions.sessionTokenHash, sessionTokenHash),
        isNull(userSessions.revokedAt),
        gt(userSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) return undefined;

  const user = await findUserById(session.userId);
  if (!user) return undefined;

  return { session, user };
}

export async function upsertDevice(input: {
  userId: number;
  deviceId: string;
  fcmToken: string;
  platform: 'ios' | 'android';
  appVersion: string;
  language: 'uz' | 'ru';
}): Promise<void> {
  await db
    .insert(userDevices)
    .values(input)
    .onConflictDoUpdate({
      target: userDevices.deviceId,
      set: {
        userId: input.userId,
        fcmToken: input.fcmToken,
        platform: input.platform,
        appVersion: input.appVersion,
        language: input.language,
        updatedAt: new Date(),
      },
    });
}

/**
 * Register (upsert) a device and mark it trusted for PIN/biometric login by
 * stamping `activatedAt`. Called from /setup after a full OTP + MyID onboarding.
 * Re-running for the same raw deviceId re-assigns it to `userId` (a device that
 * changes hands) — callers revoke that device's prior sessions. Any previously
 * enrolled biometric key is cleared here: on re-activation the row may now point
 * at a different user, so the old owner's public key must never survive. The new
 * owner re-enrols via register-device (their Secure Enclave holds a fresh key).
 * Returns the user_devices.id (uuid) to bind the session to.
 */
export async function activateDevice(input: {
  userId: number;
  deviceId: string;
  platform: 'ios' | 'android';
  appVersion: string;
}): Promise<string> {
  const now = new Date();
  const [row] = await db
    .insert(userDevices)
    .values({
      userId: input.userId,
      deviceId: input.deviceId,
      platform: input.platform,
      appVersion: input.appVersion,
      activatedAt: now,
    })
    .onConflictDoUpdate({
      target: userDevices.deviceId,
      set: {
        userId: input.userId,
        platform: input.platform,
        appVersion: input.appVersion,
        activatedAt: now,
        publicKey: null,
        keyRegisteredAt: null,
        updatedAt: now,
      },
    })
    .returning({ id: userDevices.id });

  return row!.id;
}

/** Look up a device by its raw client identifier (the x-device-id header). */
export async function findDeviceByDeviceId(deviceId: string) {
  const [row] = await db
    .select()
    .from(userDevices)
    .where(eq(userDevices.deviceId, deviceId))
    .limit(1);
  return row;
}

/** Look up a device by its primary key (user_devices.id). */
export async function findDeviceById(id: string) {
  const [row] = await db.select().from(userDevices).where(eq(userDevices.id, id)).limit(1);
  return row;
}

/** Revoke every active session bound to a device (user_devices.id). */
export async function revokeDeviceSessions(deviceId: string): Promise<void> {
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.deviceId, deviceId), isNull(userSessions.revokedAt)));
}

export async function clearDeviceFcmToken(deviceId: string): Promise<void> {
  await db
    .update(userDevices)
    .set({ fcmToken: null, updatedAt: new Date() })
    .where(eq(userDevices.deviceId, deviceId));
}

/** Revoke the session matching the given raw token, if any. */
export async function revokeSession(sessionToken: string): Promise<void> {
  const sessionTokenHash = hashToken(sessionToken);
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(eq(userSessions.sessionTokenHash, sessionTokenHash));
}

/**
 * Exchange a durable session token for a freshly-minted one: validate the old
 * token, verify it belongs to the requesting device, revoke it, and issue a new
 * session bound to the same device. Reserved for boundary events that should
 * deliberately rotate the durable token; the hot-path refresh uses
 * refreshAccessToken instead, which leaves the token in place. `expectedDeviceId`
 * is the caller's raw x-device-id; the new token is pinned to it so a leaked
 * token cannot be replayed elsewhere. Returns undefined when the token is
 * invalid/expired/revoked or the device does not match.
 */
export async function rotateSession(
  oldToken: string,
  expectedDeviceId: string,
): Promise<{ user: typeof users.$inferSelect; sessionToken: string } | undefined> {
  const current = await verifySession(oldToken);
  if (!current) return undefined;

  const device = await findDeviceById(current.session.deviceId);
  if (!device || device.deviceId !== expectedDeviceId) return undefined;

  await revokeSession(oldToken);
  const { sessionToken } = await createSession(current.user.id, current.session.deviceId);
  return { user: current.user, sessionToken };
}

/**
 * Hot-path refresh: validate a durable session token and confirm it belongs to
 * the requesting device, without rotating it. Returns the session's user so the
 * caller can mint a fresh short-lived access token; the session token is left in
 * place (it keeps its original expiry). Boundary events that must rotate the
 * durable token use rotateSession instead. `expectedDeviceId` is the caller's
 * raw x-device-id, pinning the refresh to the device the session was issued to
 * so a leaked session token cannot be replayed from elsewhere. Returns undefined
 * when the token is invalid/expired/revoked or the device does not match.
 */
export async function refreshAccessToken(
  sessionToken: string,
  expectedDeviceId: string,
): Promise<{ user: typeof users.$inferSelect } | undefined> {
  const current = await verifySession(sessionToken);
  if (!current) return undefined;

  const device = await findDeviceById(current.session.deviceId);
  if (!device || device.deviceId !== expectedDeviceId) return undefined;

  return { user: current.user };
}

/**
 * Set (or change) a user's app PIN. Stores an argon2 hash of the 4-digit code;
 * the raw PIN is never persisted.
 */
export async function setUserPin(userId: number, pin: string): Promise<void> {
  const pinHash = await argon2.hash(pin);
  await db.update(users).set({ pinHash, pinSetAt: new Date() }).where(eq(users.id, userId));
}

/** Verify a candidate PIN against the user's stored hash. */
export async function verifyUserPin(
  user: typeof users.$inferSelect,
  pin: string,
): Promise<boolean> {
  if (!user.pinHash) return false;
  return argon2.verify(user.pinHash, pin);
}

/**
 * Set (or change) a user's account password. Stores an argon2 hash; the raw
 * password is never persisted. This is the portable credential used by
 * phone+password login — distinct from the optional on-device PIN.
 */
export async function setUserPassword(userId: number, password: string): Promise<void> {
  const passwordHash = await argon2.hash(password);
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
}

/** Verify a candidate password against the user's stored hash. */
export async function verifyUserPassword(
  user: typeof users.$inferSelect,
  password: string,
): Promise<boolean> {
  if (!user.passwordHash) return false;
  return argon2.verify(user.passwordHash, password);
}

/** Revoke every active session a user holds, across all devices. */
export async function revokeAllUserSessions(userId: number): Promise<void> {
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(userSessions.userId, userId), isNull(userSessions.revokedAt)));
}

/**
 * Revoke every active session a user holds except the one identified by
 * `keepSessionToken` (raw). Used on an authenticated password change to log the
 * account out everywhere but the device performing the change.
 */
export async function revokeUserSessionsExcept(
  userId: number,
  keepSessionToken: string,
): Promise<void> {
  const keepHash = hashToken(keepSessionToken);
  await db
    .update(userSessions)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(userSessions.userId, userId),
        isNull(userSessions.revokedAt),
        ne(userSessions.sessionTokenHash, keepHash),
      ),
    );
}

/* ── Biometric (hardware-backed keypair) auth ────────────────────────────────
 *
 * The device generates an ES256 (P-256) keypair in its Secure Enclave / Android
 * Keystore; the private key never leaves the hardware. We store only the public
 * key (base64 SPKI-DER). Login proves possession of the private key by signing a
 * single-use server nonce — no secret ever crosses the wire. */

/** How long a biometric challenge stays valid (seconds); single-use besides. */
const BIOMETRIC_CHALLENGE_TTL_SECONDS = 120;

/** Redis key holding a pending biometric challenge by its id. */
function biometricChallengeKey(challengeId: string): string {
  return `client:biometric:challenge:${challengeId}`;
}

/**
 * Parse a base64 SPKI-DER public key and assert it is an EC key on the P-256
 * (prime256v1) curve — the only curve iOS Secure Enclave supports and the one we
 * verify ES256 signatures against. Returns the KeyObject, or undefined if the
 * bytes are not a well-formed P-256 SPKI key.
 */
function parseP256PublicKey(publicKeyB64: string): KeyObject | undefined {
  try {
    const key = createPublicKey({
      key: Buffer.from(publicKeyB64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    if (key.asymmetricKeyType !== 'ec') return undefined;
    if (key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') return undefined;
    return key;
  } catch {
    return undefined;
  }
}

/**
 * Store (or replace) a device's biometric public key. `publicKeyB64` must be a
 * base64 SPKI-DER P-256 key; returns false if it fails to parse. `deviceRowId`
 * is the user_devices.id. Re-enrolment simply overwrites the prior key.
 */
export async function registerDeviceKey(
  deviceRowId: string,
  publicKeyB64: string,
): Promise<boolean> {
  if (!parseP256PublicKey(publicKeyB64)) return false;
  await db
    .update(userDevices)
    .set({ publicKey: publicKeyB64, keyRegisteredAt: new Date(), updatedAt: new Date() })
    .where(eq(userDevices.id, deviceRowId));
  return true;
}

/** Remove a device's biometric public key (disables biometric login). */
export async function clearDeviceKey(deviceRowId: string): Promise<void> {
  await db
    .update(userDevices)
    .set({ publicKey: null, keyRegisteredAt: null, updatedAt: new Date() })
    .where(eq(userDevices.id, deviceRowId));
}

/**
 * Drop the biometric key on every device the user owns. A registered key grants
 * unauthenticated session minting via /challenge + /biometric for as long as it
 * exists, so rotating the account's root credential must evict it everywhere —
 * otherwise a password reset revokes sessions while leaving an attacker's
 * enrolled key live. Call alongside revokeAllUserSessions.
 */
export async function clearAllUserDeviceKeys(userId: number): Promise<void> {
  await db
    .update(userDevices)
    .set({ publicKey: null, keyRegisteredAt: null, updatedAt: new Date() })
    .where(eq(userDevices.userId, userId));
}

/**
 * Mint a single-use biometric challenge for the requesting device. Stores 32
 * random bytes (base64) in Redis under a fresh challengeId, bound to `deviceId`
 * (the raw x-device-id) so it can only be spent by that same device, expiring
 * after BIOMETRIC_CHALLENGE_TTL_SECONDS. Returns the id + challenge for the
 * client to sign.
 */
export async function createBiometricChallenge(
  deviceId: string,
): Promise<{ challengeId: string; challenge: string }> {
  const challengeId = randomUUID();
  const challenge = randomBytes(32).toString('base64');
  await redis.set(
    biometricChallengeKey(challengeId),
    JSON.stringify({ challenge, deviceId }),
    'EX',
    BIOMETRIC_CHALLENGE_TTL_SECONDS,
  );
  return { challengeId, challenge };
}

/**
 * Atomically fetch-and-delete a pending challenge (GETDEL) so it is strictly
 * single-use: a failed verification still consumes it, leaving no fixed nonce to
 * hammer. Returns the stored challenge + bound deviceId, or undefined if the id
 * is unknown, already spent, or expired.
 */
export async function consumeBiometricChallenge(
  challengeId: string,
): Promise<{ challenge: string; deviceId: string } | undefined> {
  const raw = await redis.getdel(biometricChallengeKey(challengeId)).catch(() => null);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as { challenge: string; deviceId: string };
  } catch {
    return undefined;
  }
}

/**
 * Verify an ES256 signature over the raw (base64-decoded) challenge bytes
 * against a stored base64 SPKI-DER P-256 public key. `signatureB64` is a
 * base64 DER-encoded (X9.62) ECDSA signature. Returns false on any malformed
 * input rather than throwing.
 */
export function verifyBiometricSignature(
  publicKeyB64: string,
  challengeB64: string,
  signatureB64: string,
): boolean {
  const key = parseP256PublicKey(publicKeyB64);
  if (!key) return false;
  try {
    const verifier = createVerify('SHA256');
    verifier.update(Buffer.from(challengeB64, 'base64'));
    verifier.end();
    return verifier.verify({ key, dsaEncoding: 'der' }, Buffer.from(signatureB64, 'base64'));
  } catch {
    return false;
  }
}
