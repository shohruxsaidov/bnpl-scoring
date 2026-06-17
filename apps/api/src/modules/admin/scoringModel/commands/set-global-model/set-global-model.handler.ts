import { eq, ne } from "drizzle-orm"
import { db } from "@db"
import { scoringModels, scoringModelRevisions } from "../../schema"

// Atomic switch of the Global Model mark (ADR-0023): unmarking the previous
// holder and marking the new one happen in one transaction, so the
// exactly-one invariant (partial unique index) is never violated.
// A model with no revisions is not scorable and may never become Global —
// resolveScoringModel would return null for every unassigned merchant.
export async function setGlobalModel(id: number) {
  return db.transaction(async (tx) => {
    const [revision] = await tx
      .select({ id: scoringModelRevisions.id })
      .from(scoringModelRevisions)
      .where(eq(scoringModelRevisions.scoringModelId, id))
      .limit(1)
    if (!revision) {
      throw Object.assign(new Error('scoring_model_has_no_revisions'), { statusCode: 409 })
    }
    await tx
      .update(scoringModels)
      .set({ isGlobal: false })
      .where(ne(scoringModels.id, id))
    const [row] = await tx
      .update(scoringModels)
      .set({ isGlobal: true })
      .where(eq(scoringModels.id, id))
      .returning()
    if (!row) {
      throw Object.assign(new Error('not_found'), { statusCode: 404 })
    }
    return row
  })
}
