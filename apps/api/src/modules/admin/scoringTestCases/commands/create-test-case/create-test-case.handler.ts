import { db } from "@db"
import { scoringTestCases } from "@db/schema"
import type { CreateTestCaseCommand } from "./create-test-case.command"

export async function createTestCase({ name, description, inputs, expectedOutcome }: CreateTestCaseCommand) {
  const [row] = await db
    .insert(scoringTestCases)
    .values({
      name,
      description: description ?? null,
      inputs: inputs as Record<string, unknown>,
      expectedOutcome,
    })
    .returning()
  return row!
}
