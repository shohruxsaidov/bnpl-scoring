import { db } from "@db"
import { eq } from "drizzle-orm"
import { scoringTestCases } from "@db/schema"

export async function deleteTestCase(id: number) {
  const deleted = await db
    .delete(scoringTestCases)
    .where(eq(scoringTestCases.id, id))
    .returning({ id: scoringTestCases.id })
  return deleted.length > 0
}
