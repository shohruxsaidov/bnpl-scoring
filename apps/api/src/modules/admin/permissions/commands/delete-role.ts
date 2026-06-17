import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { roles } from "../../../id/db/schema"

export async function deleteRole(db: Db, id: number) {
  await db.delete(roles).where(eq(roles.id, id))
}
