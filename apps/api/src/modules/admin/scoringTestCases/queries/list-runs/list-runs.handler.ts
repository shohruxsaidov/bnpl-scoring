import { db } from "@db"
import { desc } from "drizzle-orm"
import { scoringTestRuns } from "@db/schema"

export function listRuns() {
  return db
    .select({
      id: scoringTestRuns.id,
      modelRevisionId: scoringTestRuns.modelRevisionId,
      ranAt: scoringTestRuns.ranAt,
      passCount: scoringTestRuns.passCount,
      failCount: scoringTestRuns.failCount,
    })
    .from(scoringTestRuns)
    .orderBy(desc(scoringTestRuns.ranAt))
}
