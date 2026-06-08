import { desc, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { clients } from "../../../id/db/schema"
import { scoringHistories } from "../../../deals/db/schema"

export async function listClientScoring(db: Db, id: bigint) {
  const clientRows = await db.select({ pinfl: clients.pinfl }).from(clients).where(eq(clients.id, id)).limit(1)
  if (!clientRows[0]) return []
  const pinfl = clientRows[0].pinfl

  const rows = await db
    .select()
    .from(scoringHistories)
    .where(eq(scoringHistories.pinfl, pinfl))
    .orderBy(desc(scoringHistories.scoredAt))

  return rows.map((r) => ({
    id: r.id.toString(),
    source: r.clientId != null ? ("wizard" as const) : ("self-service" as const),
    decision: r.decision,
    score: r.scoreSum != null ? Number(r.scoreSum) : 0,
    limit: Number(r.platformCreditLimit),
    scoredAt: r.scoredAt.toISOString(),
  }))
}
