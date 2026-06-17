import { db } from "@db"
import { scoringModels } from "../../schema"
import type { CreateScoringModelCommand } from "./create-scoring-model.command"

export async function createScoringModel(input: CreateScoringModelCommand) {
  const [row] = await db.insert(scoringModels).values({ name: input.name }).returning()
  return row!
}
