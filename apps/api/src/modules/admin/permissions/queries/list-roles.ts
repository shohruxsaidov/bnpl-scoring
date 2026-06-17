import { eq, inArray } from 'drizzle-orm';
import type { Db } from '../../../../db';
import { rolePermissions, roles } from '../../../id/db/schema';
import type { Platform } from '../../../../rbac/features';

export interface RoleWithFeatures {
  id: string;
  key: string;
  name: string;
  platform: string;
  isSuperAdmin: boolean;
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
    .where(
      inArray(
        rolePermissions.roleId,
        roleRows.map((r) => r.id),
      ),
    );

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
    isSuperAdmin: r.isSuperAdmin,
    isSystem: r.isSystem,
    features: byRole.get(r.id.toString()) ?? [],
  }));
}
