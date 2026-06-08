import { desc, eq } from 'drizzle-orm'
import type { Db } from '../../../db/index.js'
import { scoringModelRevisions } from './db/schema.js'
import type { ScoringModelParams } from '../../scoring/engine.js'

export async function getActiveModel(db: Db) {
  const [row] = await db
    .select()
    .from(scoringModelRevisions)
    .orderBy(desc(scoringModelRevisions.id))
    .limit(1)
  return row ?? null
}

export async function getModelById(db: Db, id: number) {
  const [row] = await db
    .select()
    .from(scoringModelRevisions)
    .where(eq(scoringModelRevisions.id, id))
    .limit(1)
  return row ?? null
}

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

export async function saveModel(
  db: Db,
  input: { name: string; version: string; params: ScoringModelParams },
  createdBy: bigint | null,
) {
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
