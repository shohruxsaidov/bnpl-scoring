import { and, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { scoringModelRevisions } from "../db/schema"
import type { ScoringModelData } from "../../../scoring/engine"

export async function saveModel(
  db: Db,
  input: { scoringModelId: number; name: string; version: string; params: ScoringModelData },
  createdBy: number | null,
) {
  const existing = await db
    .select({ id: scoringModelRevisions.id })
    .from(scoringModelRevisions)
    .where(
      and(
        eq(scoringModelRevisions.scoringModelId, input.scoringModelId),
        eq(scoringModelRevisions.version, input.version),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    throw Object.assign(new Error('version_taken'), { statusCode: 409 })
  }

  const [row] = await db
    .insert(scoringModelRevisions)
    .values({
      scoringModelId: input.scoringModelId,
      name: input.name,
      version: input.version,
      params: input.params as unknown as Record<string, unknown>,
      createdBy,
    })
    .returning()
  return row!
}
