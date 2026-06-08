import { eq } from "drizzle-orm"
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

export async function listEmployees(db: Db, merchantId: bigint) {
  return db.select(safeSelect).from(merchantUsers).where(eq(merchantUsers.merchantId, merchantId)).orderBy(merchantUsers.createdAt)
}
