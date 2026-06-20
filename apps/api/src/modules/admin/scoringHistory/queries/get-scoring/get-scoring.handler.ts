import { eq, inArray } from "drizzle-orm"
import { db } from "@db"
import { scoringHistories, deals, dealPaymentSchedules } from "../../../../deals/schema"

export interface ScoringFactor {
  label: string
  score: number
}

export interface CriterionResult {
  key: string
  name: string
  rawScore: number
  weightedScore: number
  importantLevel: number
  skipped: boolean
}

export type ModelData =
  | { rejected: true; stopFactor: string; name: string }
  | { rejected: false; totalScore: number; coefficient: number; breakdown: CriterionResult[] }

export interface KatmData {
  katmScore: number | null
  katmClass: string | null
  scoringLevel: string | null
  openCredits: number | null
  totalDebt: number | null
  overdueInOpenCredits: number | null
  totalContracts: number | null
  totalClaims: number | null
  overdueCount: number | null
  maxOverdueDays: number | null
  maxOverdueSum: number | null
  avgMonthlyPayment: number | null
  hasCreditBan: boolean | null
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
  birthDate: string | null
  gender: string | null
  coefficient: number | null
  factors: ScoringFactor[]
  katmData: KatmData | null
  modelData: ModelData | null
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

  const criteriaScores = scoring.criteriaScores as Record<string, unknown> | null
  const clientDetail = (criteriaScores?.client as Record<string, unknown> | undefined)
    ?.detail as Record<string, unknown> | undefined
  const birthDate = (clientDetail?.birthDate as string | undefined) ?? null
  const rawGender = clientDetail?.gender as string | undefined
  const gender = rawGender === "1" ? "Erkak" : rawGender === "2" ? "Ayol" : null

  const rawModel = criteriaScores?.model as Record<string, unknown> | undefined
  let modelData: ModelData | null = null
  if (rawModel) {
    if (rawModel.rejected === true) {
      modelData = {
        rejected: true,
        stopFactor: rawModel.stopFactor as string,
        name: rawModel.name as string,
      }
    } else if (rawModel.rejected === false) {
      modelData = {
        rejected: false,
        totalScore: Number(rawModel.totalScore),
        coefficient: Number(rawModel.coefficient),
        breakdown: (rawModel.breakdown as CriterionResult[] | undefined) ?? [],
      }
    }
  }

  const katmDetail = (criteriaScores?.katm as Record<string, unknown> | undefined)
    ?.detail as Record<string, unknown> | undefined
  const katmData: KatmData | null = katmDetail
    ? {
        katmScore: katmDetail.katmScore != null ? Number(katmDetail.katmScore) : null,
        katmClass: (katmDetail.katmClass as string | undefined) ?? null,
        scoringLevel: (katmDetail.scoringLevel as string | undefined) ?? null,
        openCredits: katmDetail.openCredits != null ? Number(katmDetail.openCredits) : null,
        totalDebt: katmDetail.totalDebt != null ? Number(katmDetail.totalDebt) : null,
        overdueInOpenCredits: katmDetail.overdueInOpenCredits != null ? Number(katmDetail.overdueInOpenCredits) : null,
        totalContracts: katmDetail.totalContracts != null ? Number(katmDetail.totalContracts) : null,
        totalClaims: katmDetail.totalClaims != null ? Number(katmDetail.totalClaims) : null,
        overdueCount: katmDetail.overdueCount != null ? Number(katmDetail.overdueCount) : null,
        maxOverdueDays: katmDetail.maxOverdueDays != null ? Number(katmDetail.maxOverdueDays) : null,
        maxOverdueSum: katmDetail.maxOverdueSum != null ? Number(katmDetail.maxOverdueSum) : null,
        avgMonthlyPayment: katmDetail.avgMonthlyPayment != null ? Number(katmDetail.avgMonthlyPayment) : null,
        hasCreditBan: katmDetail.hasCreditBan != null ? Boolean(katmDetail.hasCreditBan) : null,
      }
    : null

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
    birthDate,
    gender,
    coefficient: scoring.coefficient != null ? Number(scoring.coefficient) : null,
    factors: criteriaToFactors(criteriaScores),
    katmData,
    modelData,
    platformStats,
  }
}
