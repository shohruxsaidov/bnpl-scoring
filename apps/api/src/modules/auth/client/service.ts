import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, ilike, isNull, or } from "drizzle-orm";
import type { Db } from "../../../db/index.js";
import {
  clientDevices,
  clientSessions,
  otpVerifications,
  users,
} from "../../id/db/schema.js";
import { env } from "../../../env.js";

export type OtpPurpose = "login" | "register" | "client_registration" | "deal_signing";

/** Hash a raw token with SHA-256, hex-encoded. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Generate a random 4-digit OTP string (zero-padded). */
export function generateOtp(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, "0");
}

/**
 * Delete any existing unused OTPs for the same phone+purpose, then insert a
 * fresh code valid for 5 minutes. Returns the generated code.
 */
export async function createOtp(
  db: Db,
  phone: string,
  purpose: OtpPurpose,
): Promise<string> {
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
  db: Db,
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

export async function findUserByPhone(db: Db, phone: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.phone, phone))
    .limit(1);
  return row;
}

export async function findUserById(db: Db, id: number) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row;
}

export async function searchUsers(db: Db, q: string, limit = 20) {
  const term = `%${q}%`;
  return db
    .select()
    .from(users)
    .where(
      or(
        ilike(users.firstName, term),
        ilike(users.lastName, term),
        ilike(users.pinfl, term),
      ),
    )
    .limit(limit);
}

export async function findUserByPinfl(db: Db, pinfl: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.pinfl, pinfl))
    .limit(1);
  return row;
}

export async function createUser(
  db: Db,
  input: {
    phone: string;
    pinfl: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    birthDate: string;
    gender: string;
    nationality: string;
    passportSerial: string | null;
    passportNumber: string | null;
    photoUrl: string | null;
  },
) {
  const [row] = await db
    .insert(users)
    .values({
      phone: input.phone,
      pinfl: input.pinfl,
      firstName: input.firstName,
      lastName: input.lastName,
      birthDate: input.birthDate,
      gender: input.gender,
      nationality: input.nationality,
      passportSerial: input.passportSerial,
      passportNumber: input.passportNumber,
      photoUrl: input.photoUrl,
      myidVerifiedAt: new Date(),
    })
    .returning();
  return row!;
}

/**
 * Create a session for a user. Generates a random opaque token, stores only
 * its hash, and returns the raw token to be set as the `session_id` cookie.
 */
export async function createSession(
  db: Db,
  userId: number,
): Promise<{ sessionId: string; sessionToken: string }> {
  const sessionToken = randomUUID() + randomBytes(16).toString("hex");
  const sessionTokenHash = hashToken(sessionToken);
  const expiresAt = new Date(
    Date.now() + env.SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000,
  );

  const [row] = await db
    .insert(clientSessions)
    .values({ userId, sessionTokenHash, expiresAt })
    .returning({ id: clientSessions.id });

  return { sessionId: row!.id, sessionToken };
}

/**
 * Resolve a raw session token to its session + user, provided the session is
 * unexpired and not revoked. Returns undefined when invalid.
 */
export async function verifySession(db: Db, sessionToken: string) {
  const sessionTokenHash = hashToken(sessionToken);

  const [session] = await db
    .select()
    .from(clientSessions)
    .where(
      and(
        eq(clientSessions.sessionTokenHash, sessionTokenHash),
        isNull(clientSessions.revokedAt),
        gt(clientSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) return undefined;

  const user = await findUserById(db, session.userId);
  if (!user) return undefined;

  return { session, user };
}

export async function upsertDevice(
  db: Db,
  input: { userId: number; deviceId: string; fcmToken: string; platform: 'ios' | 'android'; appVersion: string },
): Promise<void> {
  await db
    .insert(clientDevices)
    .values(input)
    .onConflictDoUpdate({
      target: clientDevices.deviceId,
      set: {
        userId: input.userId,
        fcmToken: input.fcmToken,
        platform: input.platform,
        appVersion: input.appVersion,
        updatedAt: new Date(),
      },
    });
}

export async function clearDeviceFcmToken(db: Db, deviceId: string): Promise<void> {
  await db
    .update(clientDevices)
    .set({ fcmToken: null, updatedAt: new Date() })
    .where(eq(clientDevices.deviceId, deviceId));
}

/** Revoke the session matching the given raw token, if any. */
export async function revokeSession(
  db: Db,
  sessionToken: string,
): Promise<void> {
  const sessionTokenHash = hashToken(sessionToken);
  await db
    .update(clientSessions)
    .set({ revokedAt: new Date() })
    .where(eq(clientSessions.sessionTokenHash, sessionTokenHash));
}
