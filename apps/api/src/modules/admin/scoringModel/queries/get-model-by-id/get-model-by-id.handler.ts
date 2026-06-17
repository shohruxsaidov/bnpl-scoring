import { eq } from "drizzle-orm"
import { db } from "@db"
import { scoringModelRevisions } from "../../schema"

export async function getModelById(id: number) {
  const [row] = await db
    .select()
    .from(scoringModelRevisions)
    .where(eq(scoringModelRevisions.id, id))
    .limit(1)
  return row ?? null
}
