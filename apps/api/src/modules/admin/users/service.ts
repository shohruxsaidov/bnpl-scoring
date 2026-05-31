import { eq } from "drizzle-orm"
import type { Db } from "../../../db"
import { adminUsers, roles } from "../../id/db/schema"
import { hashPassword } from "../../auth/admin/service"

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

export async function getAdminUser(db: Db, id: bigint) {
  const [row] = await db
    .select(userSelect)
    .from(adminUsers)
    .leftJoin(roles, eq(adminUsers.roleId, roles.id))
    .where(eq(adminUsers.id, id))
    .limit(1)
  return row
}

export async function createAdminUser(
  db: Db,
  input: { email: string; fullName: string; password: string; roleId: bigint; createdById: bigint },
) {
  const passwordHash = await hashPassword(input.password)
  const [row] = await db
    .insert(adminUsers)
    .values({
      email: input.email.toLowerCase(),
      passwordHash,
      fullName: input.fullName,
      roleId: input.roleId,
      createdById: input.createdById,
    })
    .returning({ id: adminUsers.id })
  return row!
}

export async function updateAdminUser(
  db: Db,
  id: bigint,
  input: Partial<{ active: boolean }>,
) {
  const [row] = await db
    .update(adminUsers)
    .set(input)
    .where(eq(adminUsers.id, id))
    .returning({ id: adminUsers.id })
  return row
}
