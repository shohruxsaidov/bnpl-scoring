import { desc } from "drizzle-orm"
import type { Db } from "../../../../db"
import { scoringModelRevisions } from "../db/schema"

export async function listModels(db: Db) {
  return db
    .select({
      id: scoringModelRevisions.id,
      name: scoringModelRevisions.name,
      version: scoringModelRevisions.version,
      createdAt: scoringModelRevisions.createdAt,
    })
    .from(scoringModelRevisions)
    .orderBy(desc(scoringModelRevisions.id))
}
