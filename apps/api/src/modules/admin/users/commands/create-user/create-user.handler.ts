import { db } from '@db'
import { adminUsers } from '@db/schema'
import { hashPassword } from "../../../../auth/admin/service/service.handler"
import type { CreateAdminUserCommand } from "./create-user.command"

export async function createAdminUser(input: CreateAdminUserCommand) {
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
