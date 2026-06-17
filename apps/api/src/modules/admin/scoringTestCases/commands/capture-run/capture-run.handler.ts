import { db } from "@db"
import { eq } from "drizzle-orm"
import { scoringTestCases, scoringTestRuns } from "@db/schema"
import type { ApprovalOutcome } from "../create-test-case/create-test-case.command"

export async function captureRun(id: number) {
  const [run] = await db
    .select()
    .from(scoringTestRuns)
    .where(eq(scoringTestRuns.id, id))
    .limit(1)
  if (!run) return null

  const results = run.results as Array<{ testCaseId: string; actualOutcome: ApprovalOutcome }>
  await Promise.all(
    results.map(({ testCaseId, actualOutcome }) =>
      db
        .update(scoringTestCases)
        .set({ expectedOutcome: actualOutcome, updatedAt: new Date() })
        .where(eq(scoringTestCases.id, Number(testCaseId))),
    ),
  )

  return { captured: results.length }
}
