import { eq } from "drizzle-orm"
import { db } from "@db"
import { roles } from '@db/schema'

export async function deleteRole(id: number) {
  await db.delete(roles).where(eq(roles.id, id))
}
