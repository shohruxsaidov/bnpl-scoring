import { db } from "@db"
import { eq } from "drizzle-orm"
import { scoringTestCases } from "@db/schema"
import type { UpdateTestCaseCommand } from "./update-test-case.command"

export async function updateTestCase({ id, name, description, inputs, expectedOutcome }: UpdateTestCaseCommand) {
  const existing = await db
    .select({ id: scoringTestCases.id })
    .from(scoringTestCases)
    .where(eq(scoringTestCases.id, id))
    .limit(1)
  if (!existing.length) return null

  const updates: Partial<typeof scoringTestCases.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description
  if (inputs !== undefined) updates.inputs = inputs as Record<string, unknown>
  if (expectedOutcome !== undefined) updates.expectedOutcome = expectedOutcome

  const [row] = await db
    .update(scoringTestCases)
    .set(updates)
    .where(eq(scoringTestCases.id, id))
    .returning()
  return row!
}
