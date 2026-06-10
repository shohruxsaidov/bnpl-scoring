import type { Db } from "../../../../db"
import { scoringModels } from "../db/schema"

export async function createScoringModel(db: Db, input: { name: string }) {
  const [row] = await db.insert(scoringModels).values({ name: input.name }).returning()
  return row!
}
