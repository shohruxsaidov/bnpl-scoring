import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { scoringHistories } from "../../../deals/db/schema"

export interface ScoringFactor {
  label: string
  score: number
}

export interface ScoringDetail {
  id: string
  fullName: string
  firstName: string
  lastName: string
  middleName: string
  phone: string
  score: number
  limit: number
  status: "review" | "approved" | "declined"
  scoredAt: string
  pinfl: string
  passport: string
  coefficient: number | null
  factors: ScoringFactor[]
}

const CRITERIA_LABELS: Record<string, string> = {
  income: "Daromad",
  workPeriod: "Ish staji",
  creditHistory: "KATM reyting",
  overdues: "Muddati o'tgan",
  liabilities: "Majburiyatlar",
  demographics: "Demografiya",
  cardScore: "Karta bahosi",
  katmScore: "KATM bahosi",
  activeLoans: "Faol kreditlar",
  overdueCount: "Muddati o'tgan kreditlar",
}

function criteriaToFactors(
  criteriaScores: Record<string, number> | null | undefined,
): ScoringFactor[] {
  if (!criteriaScores) return []
  return Object.entries(criteriaScores).map(([key, score]) => ({
    label: CRITERIA_LABELS[key] ?? key,
    score: Number(score),
  }))
}

function detailStatus(decision: string): "review" | "approved" | "declined" {
  if (decision === "approved") return "approved"
  if (decision === "declined") return "declined"
  return "review"
}

export async function getScoring(db: Db, id: bigint): Promise<ScoringDetail | null> {
  const rows = await db.select().from(scoringHistories).where(eq(scoringHistories.id, id)).limit(1)
  const scoring = rows[0]
  if (!scoring) return null

  const passport =
    scoring.passportSeries && scoring.passportNumber
      ? `${scoring.passportSeries}${scoring.passportNumber}`
      : "—"

  return {
    id: scoring.id.toString(),
    fullName:
      scoring.firstName && scoring.lastName ? `${scoring.lastName} ${scoring.firstName}` : "—",
    firstName: scoring.firstName ?? "—",
    lastName: scoring.lastName ?? "—",
    middleName: scoring.middleName ?? "",
    phone: scoring.phoneNumber ?? "—",
    score: scoring.scoreSum != null ? Number(scoring.scoreSum) : 0,
    limit: Number(scoring.platformCreditLimit),
    status: detailStatus(scoring.decision),
    scoredAt: scoring.scoredAt.toISOString(),
    pinfl: scoring.pinfl ?? "—",
    passport,
    coefficient: scoring.coefficient != null ? Number(scoring.coefficient) : null,
    factors: criteriaToFactors(scoring.criteriaScores as Record<string, number> | null),
  }
}
