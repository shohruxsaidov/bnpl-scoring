import { createHash, randomBytes, randomUUID } from 'node:crypto';
import argon2 from 'argon2';
import { and, eq, gt, ilike, isNull, or } from 'drizzle-orm';
import { db } from '@db';
import { userDevices, userSessions, otpVerifications, users } from '@db/schema';
import { env } from '../../../../env';

export type OtpPurpose = 'login' | 'register' | 'client_registration' | 'deal_signing';

/** Hash a raw token with SHA-256, hex-encoded. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Generate a random 4-digit OTP string (zero-padded). */
export function generateOtp(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

/**
 * Delete any existing unused OTPs for the same phone+purpose, then insert a
 * fresh code valid for 5 minutes. Returns the generated code.
 */
export async function createOtp(phone: string, purpose: OtpPurpose): Promise<string> {
  await db
    .delete(otpVerifications)
    .where(
      and(
        eq(otpVerifications.phone, phone),
        eq(otpVerifications.purpose, purpose),
        isNull(otpVerifications.usedAt),
      ),
    );

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
        updatedAt: new Date(),
      },
    });
}

/**
 * Register (upsert) a device and mark it trusted for PIN/biometric login by
 * stamping `activatedAt`. Called from /setup after a full OTP + MyID onboarding.
 * Re-running for the same raw deviceId re-assigns it to `userId` (a device that
 * changes hands) — callers revoke that device's prior sessions. Returns the
 * user_devices.id (uuid) to bind the session to.
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
 * Validate a durable session token against the calling device without touching
 * it: the token is confirmed unexpired/unrevoked and pinned to `expectedDeviceId`
 * (the raw x-device-id), then the owning user is returned so the caller can mint
 * a fresh access token. Backs POST /session — both the silent access-token
 * refresh and biometric login (which is that same refresh, gated client-side
 * behind a fingerprint prompt). The durable token is left unchanged; it lives
 * until logout or SESSION_EXPIRES_DAYS. Returns undefined when the token is
 * invalid/expired/revoked or the device does not match.
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
