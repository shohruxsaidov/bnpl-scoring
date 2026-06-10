import { eq, ne } from "drizzle-orm"
import type { Db } from "../../../../db"
import { scoringModels } from "../db/schema"

// Atomic switch of the Global Model mark (ADR-0023): unmarking the previous
// holder and marking the new one happen in one transaction, so the
// exactly-one invariant (partial unique index) is never violated.
export async function setGlobalModel(db: Db, id: number) {
  return db.transaction(async (tx) => {
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
