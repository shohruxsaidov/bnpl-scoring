import { and, eq } from 'drizzle-orm';
import type { Db } from '../db/index';
import { roles, rolePermissions } from '../modules/id/db/schema';
import { FEATURE_CATALOG, type Platform } from './features';

export async function findRoleByKey(db: Db, platform: Platform, key: string) {
  const [row] = await db
    .select()
    .from(roles)
    .where(and(eq(roles.platform, platform), eq(roles.key, key)))
    .limit(1);
  return row;
}

export async function findRoleById(db: Db, id: number) {
  const [row] = await db.select().from(roles).where(eq(roles.id, id)).limit(1);
  return row;
}

export async function listRoleFeatures(db: Db, roleId: number): Promise<string[]> {
  const rows = await db
    .select({ feature: rolePermissions.feature })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId));
  return rows.map((r) => r.feature);
}

// What the frontend should treat as granted. Superadmin implicitly holds the
// entire catalog; everyone else holds only their explicit grants.
export function effectiveFeatures(
  platform: Platform,
  opts: { isSuperAdmin: boolean; features: string[] },
): string[] {
  if (opts.isSuperAdmin) return [...FEATURE_CATALOG[platform]];
  return opts.features;
}
