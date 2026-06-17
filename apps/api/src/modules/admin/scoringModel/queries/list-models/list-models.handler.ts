import { desc, eq } from "drizzle-orm"
import { db } from "@db"
import { scoringModelRevisions } from "../../schema"

export async function listModels(scoringModelId: number) {
  return db
    .select({
      id: scoringModelRevisions.id,
      name: scoringModelRevisions.name,
      version: scoringModelRevisions.version,
      createdAt: scoringModelRevisions.createdAt,
    })
    .from(scoringModelRevisions)
    .where(eq(scoringModelRevisions.scoringModelId, scoringModelId))
    .orderBy(desc(scoringModelRevisions.id))
}
