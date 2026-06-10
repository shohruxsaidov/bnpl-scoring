import { desc, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { scoringModelRevisions } from "../db/schema"

export async function listModels(db: Db, scoringModelId: number) {
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
