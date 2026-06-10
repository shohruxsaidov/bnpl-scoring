import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { scoringModels } from "../db/schema"

export async function getGlobalModel(db: Db) {
  const [row] = await db
    .select()
    .from(scoringModels)
    .where(eq(scoringModels.isGlobal, true))
    .limit(1)
  return row ?? null
}
