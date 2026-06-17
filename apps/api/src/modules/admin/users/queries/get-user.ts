import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { adminUsers, roles } from '@db/schema'

const userSelect = {
  id: adminUsers.id,
  email: adminUsers.email,
  fullName: adminUsers.fullName,
  roleId: adminUsers.roleId,
  roleName: roles.name,
  roleKey: roles.key,
  isSuperAdmin: roles.isSuperAdmin,
  active: adminUsers.active,
  createdAt: adminUsers.createdAt,
}

export async function getAdminUser(db: Db, id: number) {
  const [row] = await db
    .select(userSelect)
    .from(adminUsers)
    .leftJoin(roles, eq(adminUsers.roleId, roles.id))
    .where(eq(adminUsers.id, id))
    .limit(1)
  return row
}
