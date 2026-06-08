import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { tariffs } from "../../../id/db/schema"

export async function getTariff(db: Db, id: bigint) {
  const [row] = await db.select().from(tariffs).where(eq(tariffs.id, id)).limit(1)
  return row
}
