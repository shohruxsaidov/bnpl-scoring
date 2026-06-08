import type { Db } from "../../../../db"
import { adminUsers } from "../../../id/db/schema"
import { hashPassword } from "../../../auth/admin/service"

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
