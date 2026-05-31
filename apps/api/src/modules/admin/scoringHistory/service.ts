import { desc, eq } from 'drizzle-orm';
import type { Db } from '../../../db';
import { scoringHistories } from '../../deals/db/schema';

// ---------------------------------------------------------------------------
// Criteria → human-readable label map (mirrors admin/deals)
// ---------------------------------------------------------------------------

const CRITERIA_LABELS: Record<string, string> = {
  income: 'Daromad',
  workPeriod: 'Ish staji',
  creditHistory: 'KATM reyting',
  overdues: "Muddati o'tgan",
  liabilities: 'Majburiyatlar',
  demographics: 'Demografiya',
  cardScore: 'Karta bahosi',
  katmScore: 'KATM bahosi',
  activeLoans: 'Faol kreditlar',
  overdueCount: "Muddati o'tgan kreditlar",
};

export interface ScoringFactor {
  label: string;
  score: number;
}

function criteriaToFactors(
  criteriaScores: Record<string, number> | null | undefined,
): ScoringFactor[] {
  if (!criteriaScores) return [];
  return Object.entries(criteriaScores).map(([key, score]) => ({
    label: CRITERIA_LABELS[key] ?? key,
    score: Number(score),
  }));
}

function listStatus(decision: string): 'approved' | 'declined' | 'pending' {
  if (decision === 'approved') return 'approved';
  if (decision === 'declined') return 'declined';
  return 'pending';
}

// ---------------------------------------------------------------------------
// List all scoring runs (platform-admin view)
// ---------------------------------------------------------------------------

export interface ScoringListItem {
  id: string;
  clientName: string;
  clientPhone: string;
  score: number;
  limit: number;
  scoredAt: string;
  status: 'approved' | 'declined' | 'pending';
}

export async function listScorings(db: Db): Promise<ScoringListItem[]> {
  const rows = await db
    .select()
    .from(scoringHistories)
    .orderBy(desc(scoringHistories.scoredAt));

  return rows.map((scoring) => ({
    id: scoring.id.toString(),
    clientName: scoring.firstName && scoring.lastName
      ? `${scoring.firstName} ${scoring.lastName}`
      : '—',
    clientPhone: scoring.phoneNumber ?? '—',
    score: scoring.scoreSum != null ? Number(scoring.scoreSum) : 0,
    limit: Number(scoring.platformCreditLimit),
    scoredAt: scoring.scoredAt.toISOString(),
    status: listStatus(scoring.decision),
  }));
}

// ---------------------------------------------------------------------------
// Single scoring run detail
// ---------------------------------------------------------------------------

export interface ScoringDetail {
  id: string;
  fullName: string;
  firstName: string;
  lastName: string;
  middleName: string;
  phone: string;
  score: number;
  limit: number;
  status: 'review' | 'approved' | 'declined';
  scoredAt: string;
  pinfl: string;
  passport: string;
  coefficient: number | null;
  factors: ScoringFactor[];
}

function detailStatus(decision: string): 'review' | 'approved' | 'declined' {
  if (decision === 'approved') return 'approved';
  if (decision === 'declined') return 'declined';
  return 'review';
}

export async function getScoring(db: Db, id: bigint): Promise<ScoringDetail | null> {
  const rows = await db
    .select()
    .from(scoringHistories)
    .where(eq(scoringHistories.id, id))
    .limit(1);

  const scoring = rows[0];
  if (!scoring) return null;

  const passport =
    scoring.passportSeries && scoring.passportNumber
      ? `${scoring.passportSeries}${scoring.passportNumber}`
      : '—';

  return {
    id: scoring.id.toString(),
    fullName: scoring.firstName && scoring.lastName
      ? `${scoring.lastName} ${scoring.firstName}`
      : '—',
    firstName: scoring.firstName ?? '—',
    lastName: scoring.lastName ?? '—',
    middleName: scoring.middleName ?? '',
    phone: scoring.phoneNumber ?? '—',
    score: scoring.scoreSum != null ? Number(scoring.scoreSum) : 0,
    limit: Number(scoring.platformCreditLimit),
    status: detailStatus(scoring.decision),
    scoredAt: scoring.scoredAt.toISOString(),
    pinfl: scoring.pinfl ?? '—',
    passport,
    coefficient: scoring.coefficient != null ? Number(scoring.coefficient) : null,
    factors: criteriaToFactors(scoring.criteriaScores as Record<string, number> | null),
  };
}
