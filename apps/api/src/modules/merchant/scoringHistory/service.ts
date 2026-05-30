import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from '../../../db';
import { clientScorings, deals, dealPaymentSchedules } from '../../deals/db/schema';
import { clients } from '../../id/db/schema';

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
// List all scoring runs for the current merchant (admin view)
// Scoped via the parent deal's merchant_id.
// ---------------------------------------------------------------------------

export interface ScoringListItem {
  id: string;
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

export async function listScorings(db: Db, merchantId: bigint): Promise<ScoringListItem[]> {
  // Scope by the client's merchant — a scoring run may have no deal yet (deal_id NULL).
  const rows = await db
    .select({ scoring: clientScorings, client: clients })
    .from(clientScorings)
    .innerJoin(clients, eq(clientScorings.clientId, clients.id))
    .where(eq(clients.merchantId, merchantId))
    .orderBy(desc(clientScorings.scoredAt));

  return rows.map(({ scoring, client }) => ({
    id: scoring.id.toString(),
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
// Record a scoring run (KATM + card scoring). Persisted the moment scoring
// completes — before any deal exists — so it always shows in the history.
// deal_id stays NULL until/unless the wizard reaches deal creation.
// ---------------------------------------------------------------------------

export interface CreateScoringInput {
  merchantId: bigint;
  clientId: bigint;
  scoreSum: number | null;
  coefficient: number | null;
  decision: string;
  /** Tiyin */
  platformCreditLimit: bigint;
  criteriaScores: Record<string, number> | null;
}

export async function createScoring(db: Db, input: CreateScoringInput): Promise<{ id: string }> {
  // Ensure the client belongs to this merchant before recording a scoring run.
  const [client] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, input.clientId), eq(clients.merchantId, input.merchantId)))
    .limit(1);

  if (!client) throw Object.assign(new Error('client_not_found'), { code: 'client_not_found' });

  const [row] = await db
    .insert(clientScorings)
    .values({
      clientId: input.clientId,
      dealId: null,
      criteriaScores: input.criteriaScores ?? null,
      scoreSum: input.scoreSum?.toString() ?? null,
      coefficient: input.coefficient != null ? input.coefficient.toString() : null,
      decision: input.decision,
      platformCreditLimit: input.platformCreditLimit,
    })
    .returning({ id: clientScorings.id });

  return { id: row!.id.toString() };
}

// ---------------------------------------------------------------------------
// Single scoring run — full detail for the admin detail view
// ---------------------------------------------------------------------------

export interface ScoringDetail {
  id: string;
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

export async function getScoring(
  db: Db,
  id: bigint,
  merchantId: bigint,
): Promise<ScoringDetail | null> {
  // Scope by the client's merchant — a scoring run may have no deal yet (deal_id NULL),
  // so we cannot require a join to deals here.
  const rows = await db
    .select({ scoring: clientScorings, client: clients })
    .from(clientScorings)
    .innerJoin(clients, eq(clientScorings.clientId, clients.id))
    .where(and(eq(clientScorings.id, id), eq(clients.merchantId, merchantId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;
  const { scoring, client } = row;

  // Platform history — aggregate over this client's deals at this merchant
  const platformStats = { total: 0, active: 0, closed: 0, overdue: 0, totalPaid: 0 };
  if (client) {
    const dealRows = await db
      .select({ id: deals.id, status: deals.status })
      .from(deals)
      .where(and(eq(deals.clientId, client.id), eq(deals.merchantId, merchantId)));

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
