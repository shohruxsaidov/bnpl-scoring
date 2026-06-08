import { and, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { merchantUsers } from "../../../id/db/schema"

const safeSelect = {
  id: merchantUsers.id,
  phone: merchantUsers.phone,
  fullName: merchantUsers.fullName,
  merchantId: merchantUsers.merchantId,
  branchId: merchantUsers.branchId,
  roles: merchantUsers.roles,
  mustChangePassword: merchantUsers.mustChangePassword,
  active: merchantUsers.active,
  createdAt: merchantUsers.createdAt,
}

export async function updateEmployee(
  db: Db,
  id: bigint,
  merchantId: bigint,
  input: Partial<{ fullName: string; branchId: bigint; roles: string[]; active: boolean }>,
) {
  const [row] = await db
    .update(merchantUsers)
    .set(input)
    .where(and(eq(merchantUsers.id, id), eq(merchantUsers.merchantId, merchantId)))
    .returning(safeSelect)
  return row
}
