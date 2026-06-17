import { db } from "@db"
import { eq } from "drizzle-orm"
import { scoringTestRuns } from "@db/schema"

export async function getRun(id: number) {
  const [row] = await db
    .select()
    .from(scoringTestRuns)
    .where(eq(scoringTestRuns.id, id))
    .limit(1)
  return row ?? null
}
