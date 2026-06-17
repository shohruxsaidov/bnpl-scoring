import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { merchantUsers } from "../../../id/db/schema"

export async function updateEmployee(
  db: Db,
  id: number,
  input: Partial<{ fullName: string; roles: string[]; active: boolean }>,
) {
  const [row] = await db
    .update(merchantUsers)
    .set(input)
    .where(eq(merchantUsers.id, id))
    .returning({
      id: merchantUsers.id,
      phone: merchantUsers.phone,
      fullName: merchantUsers.fullName,
      merchantId: merchantUsers.merchantId,
      branchId: merchantUsers.branchId,
      roles: merchantUsers.roles,
      mustChangePassword: merchantUsers.mustChangePassword,
      active: merchantUsers.active,
      createdAt: merchantUsers.createdAt,
    })
  return row
}
