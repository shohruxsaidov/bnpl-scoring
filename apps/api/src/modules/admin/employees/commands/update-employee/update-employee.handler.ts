import { eq } from "drizzle-orm"
import { db } from "@db"
import { merchantUsers } from '@db/schema'
import { UpdateEmployeeCommand } from './update-employee.command'

export async function updateEmployee({ id, ...input }: UpdateEmployeeCommand) {
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
