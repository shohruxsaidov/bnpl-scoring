import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@db';
import { merchantUserSessions, merchantUsers } from '@db/schema';
import { env } from '../../../../env';

const scryptAsync = promisify(scrypt);

export type MerchantRole = 'agent' | 'merchant_admin';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  const [salt, stored] = hash.split(':');
  if (!salt || !stored) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedBuf = Buffer.from(stored, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return timingSafeEqual(derived, storedBuf);
}

export async function findMerchantUserByPhone(phone: string) {
  const [row] = await db
    .select()
    .from(merchantUsers)
    .where(eq(merchantUsers.phone, phone))
    .limit(1);
  return row;
}

export async function findMerchantUserById(id: number) {
  const [row] = await db.select().from(merchantUsers).where(eq(merchantUsers.id, id)).limit(1);
  return row;
}

export async function createMerchantSession(
  merchantUserId: number,
  selectedRole: string,
): Promise<{ sessionId: string; sessionToken: string }> {
  const sessionToken = randomUUID() + randomBytes(16).toString('hex');
  const sessionTokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + env.SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  const [row] = await db
    .insert(merchantUserSessions)
    .values({ merchantUserId, selectedRole, sessionTokenHash, expiresAt })
    .returning({ id: merchantUserSessions.id });

  return { sessionId: row!.id, sessionToken };
}

export async function verifyMerchantSession(sessionToken: string) {
  const sessionTokenHash = hashToken(sessionToken);

  const [session] = await db
    .select()
    .from(merchantUserSessions)
    .where(
      and(
        eq(merchantUserSessions.sessionTokenHash, sessionTokenHash),
        isNull(merchantUserSessions.revokedAt),
        gt(merchantUserSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) return undefined;

  const employee = await findMerchantUserById(session.merchantUserId);
  if (!employee || !employee.active) return undefined;

  return { session, employee };
}

export async function changeMerchantPassword(id: number, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  await db
    .update(merchantUsers)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(merchantUsers.id, id));
}

export async function revokeMerchantSession(sessionToken: string): Promise<void> {
  const sessionTokenHash = hashToken(sessionToken);
  await db
    .update(merchantUserSessions)
    .set({ revokedAt: new Date() })
    .where(eq(merchantUserSessions.sessionTokenHash, sessionTokenHash));
}
