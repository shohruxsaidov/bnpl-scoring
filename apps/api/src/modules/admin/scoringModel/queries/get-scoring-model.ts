import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { scoringModels } from "../db/schema"

export async function getScoringModel(db: Db, id: number) {
  const [row] = await db
    .select()
    .from(scoringModels)
    .where(eq(scoringModels.id, id))
    .limit(1)
  return row ?? null
}
