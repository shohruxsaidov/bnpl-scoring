import { eq, inArray } from "drizzle-orm"
import { db } from "@db"
import { scoringHistories, deals, dealPaymentSchedules } from "../../../../deals/schema"

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
  platformStats: {
    total: number
    active: number
    closed: number
    overdue: number
    totalPaid: number
  } | null
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
  // new nested keys
  openCredits: "Faol kreditlar",
  totalDebt: "Umumiy qarz",
  overdueInOpenCredits: "Muddati o'tgan qarz",
  totalContracts: "Jami shartnomalar",
  totalClaims: "Jami so'rovlar",
  maxOverdueDays: "Maks. kechikish (kun)",
  maxOverdueSum: "Maks. muddati o'tgan summa",
  avgMonthlyPayment: "O'rt. oylik to'lov",
}

function criteriaToFactors(
  criteriaScores: Record<string, unknown> | null | undefined,
): ScoringFactor[] {
  if (!criteriaScores) return []

  // New nested format: { katm: { katmScore, detail: {...} }, card: { score } }
  const hasNestedBuckets =
    typeof criteriaScores.katm === "object" || typeof criteriaScores.card === "object"

  if (hasNestedBuckets) {
    const factors: ScoringFactor[] = []
    const katm = criteriaScores.katm as Record<string, unknown> | undefined
    const card = criteriaScores.card as Record<string, unknown> | undefined
    // client bucket contains identity data (birthDate, gender, nationality) — not scoring signals

    if (katm?.katmScore != null) {
      factors.push({ label: CRITERIA_LABELS.katmScore, score: Number(katm.katmScore) })
    }
    const katmDetail = katm?.detail as Record<string, unknown> | undefined
    if (katmDetail) {
      const numericKeys: (keyof typeof CRITERIA_LABELS)[] = [
        "openCredits", "totalDebt", "overdueInOpenCredits", "totalContracts",
        "totalClaims", "overdueCount", "maxOverdueDays", "maxOverdueSum", "avgMonthlyPayment",
      ]
      for (const key of numericKeys) {
        if (katmDetail[key] != null && typeof katmDetail[key] === "number") {
          factors.push({ label: CRITERIA_LABELS[key] ?? key, score: katmDetail[key] as number })
        }
      }
    }

    const cardDetail = card?.detail as Record<string, unknown> | undefined
    const cardScore = (cardDetail?.score ?? card?.score)
    if (cardScore != null) {
      factors.push({ label: CRITERIA_LABELS.cardScore, score: Number(cardScore) })
    }

    return factors
  }

  // Legacy flat format: { katmScore: 400, cardScore: 400, ... }
  return Object.entries(criteriaScores)
    .filter(([, v]) => typeof v === "number")
    .map(([key, score]) => ({
      label: CRITERIA_LABELS[key] ?? key,
      score: Number(score),
    }))
}

function detailStatus(decision: string): "review" | "approved" | "declined" {
  if (decision === "approved") return "approved"
  if (decision === "declined") return "declined"
  return "review"
}

export async function getScoring(id: number): Promise<ScoringDetail | null> {
  const rows = await db.select().from(scoringHistories).where(eq(scoringHistories.id, id)).limit(1)
  const scoring = rows[0]
  if (!scoring) return null

  const passport =
    scoring.passportSeries && scoring.passportNumber
      ? `${scoring.passportSeries}${scoring.passportNumber}`
      : "—"

  let platformStats: ScoringDetail["platformStats"] = null
  if (scoring.userId) {
    const dealRows = await db
      .select({ id: deals.id, status: deals.status })
      .from(deals)
      .where(eq(deals.userId, scoring.userId))

    const realDeals = dealRows.filter((d) => ["active", "closed", "overdue"].includes(d.status))
    const dealIds = realDeals.map((d) => d.id)

    let totalPaid = 0
    if (dealIds.length > 0) {
      const schedules = await db
        .select({ paidAmount: dealPaymentSchedules.paidAmount })
        .from(dealPaymentSchedules)
        .where(inArray(dealPaymentSchedules.dealId, dealIds))
      totalPaid = schedules.reduce((sum, s) => sum + Number(s.paidAmount), 0)
    }

    platformStats = {
      total: realDeals.length,
      active: realDeals.filter((d) => d.status === "active").length,
      closed: realDeals.filter((d) => d.status === "closed").length,
      overdue: realDeals.filter((d) => d.status === "overdue").length,
      totalPaid,
    }
  }

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
    factors: criteriaToFactors(scoring.criteriaScores as Record<string, unknown> | null),
    platformStats,
  }
}
