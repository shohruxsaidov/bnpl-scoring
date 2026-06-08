import { and, eq, sql } from "drizzle-orm"
import type { Db } from "../../../../db"
import { adminUsers, merchantUsers, roles } from "../../../id/db/schema"
import type { Platform } from "../../../../rbac/features"

export async function findRoleRow(db: Db, id: bigint) {
  const [row] = await db.select().from(roles).where(eq(roles.id, id)).limit(1)
  return row
}

export async function keyExists(db: Db, platform: Platform, key: string): Promise<boolean> {
  const [row] = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.platform, platform), eq(roles.key, key)))
    .limit(1)
  return !!row
}

export async function isRoleAssigned(
  db: Db,
  role: { id: bigint; key: string; platform: string },
): Promise<boolean> {
  if (role.platform === "admin") {
    const [row] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(eq(adminUsers.roleId, role.id))
      .limit(1)
    return !!row
  }
  const [row] = await db
    .select({ id: merchantUsers.id })
    .from(merchantUsers)
    .where(sql`${role.key} = ANY(${merchantUsers.roles})`)
    .limit(1)
  return !!row
}
