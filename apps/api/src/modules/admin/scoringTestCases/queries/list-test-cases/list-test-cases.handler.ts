import { db } from "@db"
import { desc } from "drizzle-orm"
import { scoringTestCases } from "@db/schema"

export function listTestCases() {
  return db
    .select()
    .from(scoringTestCases)
    .orderBy(desc(scoringTestCases.createdAt))
}
