import { eq } from "drizzle-orm"
import { db } from "@db"
import { scoringModels } from "../../schema"

export async function getScoringModel(id: number) {
  const [row] = await db
    .select()
    .from(scoringModels)
    .where(eq(scoringModels.id, id))
    .limit(1)
  return row ?? null
}
