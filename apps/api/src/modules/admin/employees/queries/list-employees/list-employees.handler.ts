import { eq } from "drizzle-orm"
import { db } from "@db"
import { merchantUsers } from '@db/schema'

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

export async function listEmployees(branchId: number) {
  return db
    .select(safeSelect)
    .from(merchantUsers)
    .where(eq(merchantUsers.branchId, branchId))
    .orderBy(merchantUsers.createdAt)
}

export async function listEmployeesByMerchant(merchantId: number) {
  return db
    .select({
      id: merchantUsers.id,
      fullName: merchantUsers.fullName,
      phone: merchantUsers.phone,
      roles: merchantUsers.roles,
      active: merchantUsers.active,
    })
    .from(merchantUsers)
    .where(eq(merchantUsers.merchantId, merchantId))
    .orderBy(merchantUsers.fullName)
}
