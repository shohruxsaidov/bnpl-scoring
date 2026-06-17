import { desc } from "drizzle-orm"
import { db } from "@db"
import { scoringHistories } from "../../../../deals/schema"

export interface ScoringListItem {
  id: string
  pinfl: string
  clientName: string
  clientPhone: string
  score: number
  limit: number
  scoredAt: string
  status: "approved" | "declined" | "pending"
}

export interface ClientListItem {
  pinfl: string
  clientName: string
  clientPhone: string
  lastScoringId: string
  lastScore: number
  lastLimit: number
  lastStatus: "approved" | "declined" | "pending"
  lastScoredAt: string
  totalRuns: number
}

function listStatus(decision: string): "approved" | "declined" | "pending" {
  if (decision === "approved") return "approved"
  if (decision === "declined") return "declined"
  return "pending"
}

export async function listAllScorings(): Promise<ScoringListItem[]> {
  const rows = await db.select().from(scoringHistories).orderBy(desc(scoringHistories.scoredAt))

  return rows.map((scoring) => ({
    id: scoring.id.toString(),
    pinfl: scoring.pinfl ?? "",
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

export async function listUniqueClients(): Promise<ClientListItem[]> {
  const rows = await db.select().from(scoringHistories).orderBy(desc(scoringHistories.scoredAt))

  const seen = new Map<string, ClientListItem>()
  const runCounts = new Map<string, number>()

  for (const scoring of rows) {
    const pinfl = scoring.pinfl ?? ""
    runCounts.set(pinfl, (runCounts.get(pinfl) ?? 0) + 1)
    if (!seen.has(pinfl)) {
      seen.set(pinfl, {
        pinfl,
        clientName:
          scoring.firstName && scoring.lastName
            ? `${scoring.firstName} ${scoring.lastName}`
            : "—",
        clientPhone: scoring.phoneNumber ?? "—",
        lastScoringId: scoring.id.toString(),
        lastScore: scoring.scoreSum != null ? Number(scoring.scoreSum) : 0,
        lastLimit: Number(scoring.platformCreditLimit),
        lastStatus: listStatus(scoring.decision),
        lastScoredAt: scoring.scoredAt.toISOString(),
        totalRuns: 0,
      })
    }
  }

  for (const [pinfl, item] of seen) {
    item.totalRuns = runCounts.get(pinfl) ?? 1
  }

  return Array.from(seen.values())
}
