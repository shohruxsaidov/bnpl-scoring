import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { roles } from "../../../id/db/schema"

export async function renameRole(db: Db, id: bigint, name: string) {
  const [row] = await db.update(roles).set({ name }).where(eq(roles.id, id)).returning()
  return row
}
