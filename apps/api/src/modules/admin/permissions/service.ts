import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../../db/index';
import { adminUsers, merchantUsers, rolePermissions, roles } from '../../id/db/schema';
import type { Platform } from '../../../rbac/features';

export interface RoleWithFeatures {
  id: string;
  key: string;
  name: string;
  platform: string;
  isSuperadmin: boolean;
  isSystem: boolean;
  features: string[];
}

export async function listRoles(db: Db, platform?: Platform): Promise<RoleWithFeatures[]> {
  const roleRows = platform
    ? await db.select().from(roles).where(eq(roles.platform, platform)).orderBy(roles.id)
    : await db.select().from(roles).orderBy(roles.id);

  if (roleRows.length === 0) return [];

  const grants = await db
    .select({ roleId: rolePermissions.roleId, feature: rolePermissions.feature })
    .from(rolePermissions)
    .where(inArray(rolePermissions.roleId, roleRows.map((r) => r.id)));

  const byRole = new Map<string, string[]>();
  for (const g of grants) {
    const key = g.roleId.toString();
    const arr = byRole.get(key) ?? [];
    arr.push(g.feature);
    byRole.set(key, arr);
  }

  return roleRows.map((r) => ({
    id: r.id.toString(),
    key: r.key,
    name: r.name,
    platform: r.platform,
    isSuperadmin: r.isSuperadmin,
    isSystem: r.isSystem,
    features: byRole.get(r.id.toString()) ?? [],
  }));
}

export async function createRole(
  db: Db,
  input: { platform: Platform; key: string; name: string },
) {
  const [row] = await db
    .insert(roles)
    .values({ platform: input.platform, key: input.key, name: input.name })
    .returning();
  return row!;
}

export async function renameRole(db: Db, id: bigint, name: string) {
  const [row] = await db.update(roles).set({ name }).where(eq(roles.id, id)).returning();
  return row;
}

export async function deleteRole(db: Db, id: bigint) {
  await db.delete(roles).where(eq(roles.id, id));
}

// Replaces a Role's grant list in one transaction, then the caller invalidates the cache.
export async function setRolePermissions(db: Db, roleId: bigint, features: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    if (features.length > 0) {
      await tx
        .insert(rolePermissions)
        .values(features.map((feature) => ({ roleId, feature })));
    }
  });
}

// A Role is "in use" if any admin holds it or any Employee carries its key.
export async function isRoleAssigned(
  db: Db,
  role: { id: bigint; key: string; platform: string },
): Promise<boolean> {
  if (role.platform === 'admin') {
    const [row] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.roleId, role.id))
      .limit(1);
    return !!row;
  }
  const [row] = await db
    .select({ id: merchantUsers.id })
    .from(merchantUsers)
    .where(sql`${role.key} = ANY(${merchantUsers.roles})`)
    .limit(1);
  return !!row;
}

export async function findRoleRow(db: Db, id: bigint) {
  const [row] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  return row;
}

export async function keyExists(db: Db, platform: Platform, key: string): Promise<boolean> {
  const [row] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.platform, platform), eq(roles.key, key)))
    .limit(1);
  return !!row;
}
