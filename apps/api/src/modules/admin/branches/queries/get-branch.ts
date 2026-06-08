import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { branches } from "../../../id/db/schema"

export async function getBranch(db: Db, id: bigint) {
  const [row] = await db.select().from(branches).where(eq(branches.id, id)).limit(1)
  return row
}
