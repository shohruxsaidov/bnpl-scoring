import { desc, eq } from "drizzle-orm"
import { db } from '@db'
import { users } from '@db/schema'
import { scoringHistories } from "../../../../deals/schema"

export async function listUserScoring(id: number) {
  const userRows = await db.select({ pinfl: users.pinfl }).from(users).where(eq(users.id, id)).limit(1)
  if (!userRows[0]) return []
  const pinfl = userRows[0].pinfl

  const rows = await db
    .select()
    .from(scoringHistories)
    .where(eq(scoringHistories.pinfl, pinfl))
    .orderBy(desc(scoringHistories.scoredAt))

  return rows.map((r) => ({
    id: r.id.toString(),
    source: r.userId != null ? ("wizard" as const) : ("self-service" as const),
    decision: r.decision,
    score: r.scoreSum != null ? Number(r.scoreSum) : 0,
    limit: Number(r.platformCreditLimit),
    scoredAt: r.scoredAt.toISOString(),
  }))
}
