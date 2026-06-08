import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { adminUsers, roles } from "../../../id/db/schema"

const userSelect = {
  id: adminUsers.id,
  email: adminUsers.email,
  fullName: adminUsers.fullName,
  roleId: adminUsers.roleId,
  roleName: roles.name,
  roleKey: roles.key,
  isSuperadmin: roles.isSuperadmin,
  active: adminUsers.active,
  createdAt: adminUsers.createdAt,
}

export async function listAdminUsers(db: Db) {
  return db
    .select(userSelect)
    .from(adminUsers)
    .leftJoin(roles, eq(adminUsers.roleId, roles.id))
    .orderBy(adminUsers.createdAt)
}
