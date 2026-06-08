import { desc } from "drizzle-orm"
import type { Db } from "../../../../db"
import { scoringModelRevisions } from "../db/schema"

export async function getActiveModel(db: Db) {
  const [row] = await db
    .select()
    .from(scoringModelRevisions)
    .orderBy(desc(scoringModelRevisions.id))
    .limit(1)
  return row ?? null
}
