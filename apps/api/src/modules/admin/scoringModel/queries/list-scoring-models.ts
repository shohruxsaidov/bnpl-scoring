import { countDistinct, desc, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { merchants, scoringModels, scoringModelRevisions } from '@db/schema'

export async function listScoringModels(db: Db) {
  return db
    .select({
      id: scoringModels.id,
      name: scoringModels.name,
      isGlobal: scoringModels.isGlobal,
      createdAt: scoringModels.createdAt,
      merchantCount: countDistinct(merchants.id),
      revisionCount: countDistinct(scoringModelRevisions.id),
    })
    .from(scoringModels)
    .leftJoin(merchants, eq(merchants.scoringModelId, scoringModels.id))
    .leftJoin(scoringModelRevisions, eq(scoringModelRevisions.scoringModelId, scoringModels.id))
    .groupBy(scoringModels.id)
    .orderBy(desc(scoringModels.isGlobal), scoringModels.id)
}
