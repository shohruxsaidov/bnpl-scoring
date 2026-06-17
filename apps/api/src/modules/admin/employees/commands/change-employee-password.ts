import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { merchantUsers } from '@db/schema'
import { hashPassword } from "../../../auth/admin/service"

export async function changeEmployeePassword(db: Db, id: number, password: string) {
  const passwordHash = await hashPassword(password)
  const [row] = await db
    .update(merchantUsers)
    .set({ passwordHash, mustChangePassword: true })
    .where(eq(merchantUsers.id, id))
    .returning({ id: merchantUsers.id })
  return row
}
