import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { and, count, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@db';
import { adminSessions, adminUsers, roles } from '@db/schema';
import { env } from '../../../../env';

const scryptAsync = promisify(scrypt);

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

export async function findAdminByEmail(email: string) {
  const [row] = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email.toLowerCase()))
    .limit(1);
  return row;
}

export async function findAdminById(id: number) {
  const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  return row;
}

export async function createAdminUser(input: {
  email: string;
  password: string;
  fullName: string;
  roleId: number;
  createdById: number;
}) {
  const passwordHash = await hashPassword(input.password);
  const [row] = await db
    .insert(adminUsers)
    .values({
      email: input.email.toLowerCase(),
      passwordHash,
      fullName: input.fullName,
      roleId: input.roleId,
      createdById: input.createdById,
    })
    .returning();
  return row!;
}

export async function listAdminUsers() {
  return db
    .select({
      id: adminUsers.id,
      email: adminUsers.email,
      fullName: adminUsers.fullName,
      roleId: adminUsers.roleId,
      active: adminUsers.active,
      createdAt: adminUsers.createdAt,
    })
    .from(adminUsers)
    .orderBy(adminUsers.createdAt);
}

export async function setAdminRole(adminId: number, roleId: number) {
  const [row] = await db
    .update(adminUsers)
    .set({ roleId })
    .where(eq(adminUsers.id, adminId))
    .returning();
  return row;
}

// Number of active admins holding a Superadmin role — used to block removing the last one.
export async function countActiveSuperadmins(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(adminUsers)
    .innerJoin(roles, eq(adminUsers.roleId, roles.id))
    .where(and(eq(adminUsers.active, true), eq(roles.isSuperAdmin, true)));
  return row?.n ?? 0;
}

export async function createAdminSession(
  adminUserId: number,
): Promise<{ sessionId: string; sessionToken: string }> {
  const sessionToken = randomUUID() + randomBytes(16).toString('hex');
  const sessionTokenHash = hashToken(sessionToken);
  const expiresAt = new Date(Date.now() + env.SESSION_EXPIRES_DAYS * 24 * 60 * 60 * 1000);

  const [row] = await db
    .insert(adminSessions)
    .values({ adminUserId, sessionTokenHash, expiresAt })
    .returning({ id: adminSessions.id });

  return { sessionId: row!.id, sessionToken };
}

export async function verifyAdminSession(sessionToken: string) {
  const sessionTokenHash = hashToken(sessionToken);

  const [session] = await db
    .select()
    .from(adminSessions)
    .where(
      and(
        eq(adminSessions.sessionTokenHash, sessionTokenHash),
        isNull(adminSessions.revokedAt),
        gt(adminSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!session) return undefined;

  const admin = await findAdminById(session.adminUserId);
  if (!admin || !admin.active) return undefined;

  return { session, admin };
}

export async function changeAdminPassword(id: number, newPassword: string): Promise<void> {
  const passwordHash = await hashPassword(newPassword);
  await db
    .update(adminUsers)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(adminUsers.id, id));
}

export async function revokeAdminSession(sessionToken: string): Promise<void> {
  const sessionTokenHash = hashToken(sessionToken);
  await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(eq(adminSessions.sessionTokenHash, sessionTokenHash));
}
