import { eq } from "drizzle-orm"
import { db } from "@db"
import { merchantUsers } from '@db/schema'

export async function getEmployee(id: number) {
  const [row] = await db
    .select({
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
    .from(merchantUsers)
    .where(eq(merchantUsers.id, id))
    .limit(1)
  return row
}
