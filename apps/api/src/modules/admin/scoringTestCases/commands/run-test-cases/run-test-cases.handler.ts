import { db } from "@db"
import { eq } from "drizzle-orm"
import { scoringTestCases, scoringTestRuns, scoringModelRevisions } from "@db/schema"
import { computeScoringModel } from "../../../../scoring/engine"
import type { ScoringModelData, ScoringInputs, ScoringResult } from "../../../../scoring/engine"
import type { ApprovalOutcome, PassedResult } from "../create-test-case/create-test-case.command"

function deriveOutcome(result: ScoringResult): ApprovalOutcome {
  if (result.rejected) return "rejected"
  const { coefficient } = result as PassedResult
  if (coefficient >= 1) return "approved"
  if (coefficient > 0) return "partial"
  return "denied"
}

export async function runTestCases(modelRevisionId: number) {
  const [revision] = await db
    .select()
    .from(scoringModelRevisions)
    .where(eq(scoringModelRevisions.id, modelRevisionId))
    .limit(1)
  if (!revision) return null

  const cases = await db.select().from(scoringTestCases).orderBy(scoringTestCases.id)

  const model = revision.params as unknown as ScoringModelData
  const results = cases.map((tc) => {
    const engineResult = computeScoringModel(model, tc.inputs as ScoringInputs)
    const actualOutcome = deriveOutcome(engineResult)
    const pass = actualOutcome === tc.expectedOutcome
    if (engineResult.rejected) {
      return {
        testCaseId: tc.id.toString(),
        name: tc.name,
        expectedOutcome: tc.expectedOutcome,
        actualOutcome,
        pass,
        totalScore: null,
        coefficient: null,
        stopFactor: engineResult.stopFactor,
        breakdown: null,
      }
    }
    const passed = engineResult as PassedResult
    return {
      testCaseId: tc.id.toString(),
      name: tc.name,
      expectedOutcome: tc.expectedOutcome,
      actualOutcome,
      pass,
      totalScore: passed.totalScore,
      coefficient: passed.coefficient,
      stopFactor: null,
      breakdown: passed.breakdown,
    }
  })

  const passCount = results.filter((r) => r.pass).length
  const failCount = results.length - passCount

  const [run] = await db
    .insert(scoringTestRuns)
    .values({
      modelRevisionId,
      passCount,
      failCount,
      results: results as unknown as Record<string, unknown>[],
    })
    .returning()

  return { run: run!, passCount, failCount, results }
}
