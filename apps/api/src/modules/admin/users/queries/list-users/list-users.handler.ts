import { eq } from "drizzle-orm"
import { db } from '@db'
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

export async function listAdminUsers() {
  return db
    .select(userSelect)
    .from(adminUsers)
    .leftJoin(roles, eq(adminUsers.roleId, roles.id))
    .orderBy(adminUsers.createdAt)
}
