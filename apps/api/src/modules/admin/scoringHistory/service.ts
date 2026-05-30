import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../../db';
import { clientScorings, deals, dealPaymentSchedules } from '../../deals/db/schema';
import { clients, merchants } from '../../id/db/schema';

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
  // KATM-derived signals captured during scoring
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
// List scoring runs across all merchants (platform-admin view).
// Optional merchantId filter, scoped via the client's merchant_id.
// ---------------------------------------------------------------------------

export interface ScoringListItem {
  id: string;
  merchantId: string;
  merchantName: string;
  clientName: string;
  clientPhone: string;
  score: number;
  /** Platform credit limit, tiyin */
  limit: number;
  region: string | null;
  address: string | null;
  scoredAt: string;
  status: 'approved' | 'declined' | 'pending';
}

export async function listScorings(
  db: Db,
  filters: { merchantId?: bigint } = {},
): Promise<ScoringListItem[]> {
  let query = db
    .select({ scoring: clientScorings, client: clients, merchant: merchants })
    .from(clientScorings)
    .innerJoin(clients, eq(clientScorings.clientId, clients.id))
    .leftJoin(merchants, eq(clients.merchantId, merchants.id))
    .orderBy(desc(clientScorings.scoredAt))
    .$dynamic();

  if (filters.merchantId) {
    query = query.where(eq(clients.merchantId, filters.merchantId));
  }

  const rows = await query;

  return rows.map(({ scoring, client, merchant }) => ({
    id: scoring.id.toString(),
    merchantId: client.merchantId.toString(),
    merchantName: merchant?.name ?? '—',
    clientName: client ? `${client.firstName} ${client.lastName}` : '—',
    clientPhone: client?.phone ?? '—',
    score: scoring.scoreSum != null ? Number(scoring.scoreSum) : 0,
    limit: Number(scoring.platformCreditLimit),
    region: null,
    address: null,
    scoredAt: scoring.scoredAt.toISOString(),
    status: listStatus(scoring.decision),
  }));
}

// ---------------------------------------------------------------------------
// Single scoring run — full detail for the detail view
// ---------------------------------------------------------------------------

export interface ScoringDetail {
  id: string;
  merchantId: string;
  merchantName: string;
  fullName: string;
  firstName: string;
  lastName: string;
  middleName: string;
  patronymic: string;
  phone: string;
  score: number;
  /** Platform credit limit, tiyin */
  limit: number;
  status: 'review' | 'approved' | 'declined';
  scoredAt: string;
  pinfl: string;
  birthDate: string;
  gender: string;
  region: string | null;
  address: string | null;
  passport: string;
  citizenship: string;
  coefficient: number | null;
  factors: ScoringFactor[];
  platformStats: {
    total: number;
    active: number;
    closed: number;
    overdue: number;
    /** Total paid across the client's deals, tiyin */
    totalPaid: number;
  };
}

function detailStatus(decision: string): 'review' | 'approved' | 'declined' {
  if (decision === 'approved') return 'approved';
  if (decision === 'declined') return 'declined';
  return 'review';
}

export async function getScoring(db: Db, id: bigint): Promise<ScoringDetail | null> {
  const rows = await db
    .select({ scoring: clientScorings, client: clients, merchant: merchants })
    .from(clientScorings)
    .innerJoin(clients, eq(clientScorings.clientId, clients.id))
    .leftJoin(merchants, eq(clients.merchantId, merchants.id))
    .where(eq(clientScorings.id, id))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  const { scoring, client, merchant } = row;

  // Platform history — aggregate over this client's deals at their merchant
  const platformStats = { total: 0, active: 0, closed: 0, overdue: 0, totalPaid: 0 };
  if (client) {
    const dealRows = await db
      .select({ id: deals.id, status: deals.status })
      .from(deals)
      .where(and(eq(deals.clientId, client.id), eq(deals.merchantId, client.merchantId)));

    const counted = dealRows.filter((d) => d.status !== 'draft');
    platformStats.total = counted.length;
    platformStats.active = counted.filter((d) => d.status === 'active').length;
    platformStats.closed = counted.filter((d) => d.status === 'closed').length;
    platformStats.overdue = counted.filter((d) => d.status === 'overdue').length;

    const dealIds = counted.map((d) => d.id);
    if (dealIds.length > 0) {
      const [paid] = await db
        .select({ total: sql<string>`coalesce(sum(${dealPaymentSchedules.paidAmount}), 0)` })
        .from(dealPaymentSchedules)
        .where(inArray(dealPaymentSchedules.dealId, dealIds));
      platformStats.totalPaid = Number(paid?.total ?? 0);
    }
  }

  const passport =
    client?.passportSerial && client?.passportNumber
      ? `${client.passportSerial}${client.passportNumber}`
      : '—';

  return {
    id: scoring.id.toString(),
    merchantId: client.merchantId.toString(),
    merchantName: merchant?.name ?? '—',
    fullName: client ? `${client.lastName} ${client.firstName}` : '—',
    firstName: client?.firstName ?? '—',
    lastName: client?.lastName ?? '—',
    middleName: client?.middleName ?? '',
    patronymic: '',
    phone: client?.phone ?? '—',
    score: scoring.scoreSum != null ? Number(scoring.scoreSum) : 0,
    limit: Number(scoring.platformCreditLimit),
    status: detailStatus(scoring.decision),
    scoredAt: scoring.scoredAt.toISOString(),
    pinfl: client?.pinfl ?? '—',
    birthDate: client?.birthDate ?? '',
    gender: client?.gender ?? '',
    region: null,
    address: null,
    passport,
    citizenship: 'УЗБЕКИСТАН',
    coefficient: scoring.coefficient != null ? Number(scoring.coefficient) : null,
    factors: criteriaToFactors(scoring.criteriaScores as Record<string, number> | null),
    platformStats,
  };
}
