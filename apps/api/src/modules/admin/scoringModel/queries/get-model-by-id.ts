import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { scoringModelRevisions } from "../db/schema"

export async function getModelById(db: Db, id: number) {
  const [row] = await db
    .select()
    .from(scoringModelRevisions)
    .where(eq(scoringModelRevisions.id, id))
    .limit(1)
  return row ?? null
}
