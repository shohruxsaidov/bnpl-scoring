import { desc, eq } from "drizzle-orm"
import { db } from "@db"
import { scoringModelRevisions } from "../../schema"

// Active revision of a Scoring Model = its latest revision (append-only).
export async function getActiveModel(scoringModelId: number) {
  const [row] = await db
    .select()
    .from(scoringModelRevisions)
    .where(eq(scoringModelRevisions.scoringModelId, scoringModelId))
    .orderBy(desc(scoringModelRevisions.id))
    .limit(1)
  return row ?? null
}
