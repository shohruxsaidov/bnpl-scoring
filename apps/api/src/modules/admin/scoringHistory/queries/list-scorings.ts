import { desc } from "drizzle-orm"
import type { Db } from "../../../../db"
import { scoringHistories } from "../../../deals/db/schema"

export interface ScoringListItem {
  id: string
  clientName: string
  clientPhone: string
  score: number
  limit: number
  scoredAt: string
  status: "approved" | "declined" | "pending"
}

function listStatus(decision: string): "approved" | "declined" | "pending" {
  if (decision === "approved") return "approved"
  if (decision === "declined") return "declined"
  return "pending"
}

export async function listScorings(db: Db): Promise<ScoringListItem[]> {
  const rows = await db.select().from(scoringHistories).orderBy(desc(scoringHistories.scoredAt))

  return rows.map((scoring) => ({
    id: scoring.id.toString(),
    clientName:
      scoring.firstName && scoring.lastName
        ? `${scoring.firstName} ${scoring.lastName}`
        : "—",
    clientPhone: scoring.phoneNumber ?? "—",
    score: scoring.scoreSum != null ? Number(scoring.scoreSum) : 0,
    limit: Number(scoring.platformCreditLimit),
    scoredAt: scoring.scoredAt.toISOString(),
    status: listStatus(scoring.decision),
  }))
}
