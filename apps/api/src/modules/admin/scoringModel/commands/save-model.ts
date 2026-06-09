import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { scoringModelRevisions } from "../db/schema"
import type { ScoringModelParams } from "../../../scoring/engine"

export async function saveModel(
  db: Db,
  input: { name: string; version: string; params: ScoringModelParams },
  createdBy: bigint | null,
) {
  const existing = await db
    .select({ id: scoringModelRevisions.id })
    .from(scoringModelRevisions)
    .where(eq(scoringModelRevisions.version, input.version))
    .limit(1)

  if (existing.length > 0) {
    throw Object.assign(new Error('version_taken'), { statusCode: 409 })
  }

  const [row] = await db
    .insert(scoringModelRevisions)
    .values({
      name: input.name,
      version: input.version,
      params: input.params as unknown as Record<string, unknown>,
      createdBy,
    })
    .returning()
  return row!
}
