import { asc, desc, eq, inArray } from 'drizzle-orm'
import type { Db } from '../../../db'
import { deals, dealItems, dealPaymentSchedules, clientScorings, dealComments } from '../../deals/db/schema'
import { clients, tariffs, merchantUsers, merchants, adminUsers } from '../../id/db/schema'

// ---------------------------------------------------------------------------
// Criteria → human-readable label map
// ---------------------------------------------------------------------------

function formatDealNumber(n: bigint | null | undefined): string {
  return n != null ? `CN-${String(n).padStart(7, '0')}` : '—'
}

const CRITERIA_LABELS: Record<string, string> = {
  income: 'Monthly income',
  workPeriod: 'Employment tenure',
  creditHistory: 'Credit history',
  overdues: 'KATM overdue count',
  liabilities: 'Active liabilities',
  demographics: 'Demographics',
  cardScore: 'Card score',
}

function criteriaToFactors(
  criteriaScores: Record<string, number> | null | undefined,
): Array<{ label: string; weight: number; value: string }> {
  if (!criteriaScores) return []
  return Object.entries(criteriaScores).map(([key, score]) => ({
    label: CRITERIA_LABELS[key] ?? key,
    weight: Number(score),
    value: String(Number(score).toFixed(2)),
  }))
}

// ---------------------------------------------------------------------------
// List all deals across all merchants (admin view)
// Filters: status, merchantId
// ---------------------------------------------------------------------------

export async function listAdminDeals(
  db: Db,
  filters: { status?: string; merchantId?: bigint } = {},
) {
  // 1. Base deal rows with joins ─────────────────────────────────────────────
  let query = db
    .select({
      deal: deals,
      client: clients,
      tariff: tariffs,
      agent: merchantUsers,
    })
    .from(deals)
    .leftJoin(clients, eq(deals.clientId, clients.id))
    .leftJoin(tariffs, eq(deals.tariffId, tariffs.id))
    .leftJoin(merchantUsers, eq(deals.agentId, merchantUsers.id))
    .orderBy(desc(deals.createdAt))
    .$dynamic()

  if (filters.status) {
    query = query.where(eq(deals.status, filters.status))
  }
  if (filters.merchantId) {
    query = query.where(eq(deals.merchantId, filters.merchantId))
  }

  const rows = await query
  const nonDraft = rows.filter((r) => r.deal.status !== 'draft')
  if (nonDraft.length === 0) return []

  const ids = nonDraft.map((r) => r.deal.id)

  // 2. Batch-load basket items, schedules, and latest scoring ───────────────
  const [itemRows, scheduleRows, scoringRows] = await Promise.all([
    db.select().from(dealItems).where(inArray(dealItems.dealId, ids)),
    db
      .select()
      .from(dealPaymentSchedules)
      .where(inArray(dealPaymentSchedules.dealId, ids))
      .orderBy(dealPaymentSchedules.dealId, dealPaymentSchedules.index),
    db
      .select()
      .from(clientScorings)
      .where(inArray(clientScorings.dealId, ids))
      .orderBy(desc(clientScorings.scoredAt)),
  ])

  // Index by dealId for O(1) lookup
  const basketByDeal = new Map<string, typeof itemRows>()
  for (const item of itemRows) {
    const arr = basketByDeal.get(item.dealId) ?? []
    arr.push(item)
    basketByDeal.set(item.dealId, arr)
  }

  const scheduleByDeal = new Map<string, typeof scheduleRows>()
  for (const row of scheduleRows) {
    const arr = scheduleByDeal.get(row.dealId) ?? []
    arr.push(row)
    scheduleByDeal.set(row.dealId, arr)
  }

  // Keep only the latest scoring per deal
  const scoringByDeal = new Map<string, (typeof scoringRows)[number]>()
  for (const s of scoringRows) {
    if (s.dealId && !scoringByDeal.has(s.dealId)) scoringByDeal.set(s.dealId, s)
  }

  // 3. Assemble ──────────────────────────────────────────────────────────────
  return nonDraft.map(({ deal, client, tariff, agent }) => {
    const scoring = scoringByDeal.get(deal.id)
    const basket = (basketByDeal.get(deal.id) ?? []).map((i) => ({
      name: i.productName,
      quantity: i.quantity,
      price: Math.round(parseFloat(i.tanNarxi) * 100),
    }))
    const schedule = (scheduleByDeal.get(deal.id) ?? []).map((s) => ({
      index: s.index,
      date: new Date(s.dueDate).toISOString(),
      amount: Number(s.amount),
      paidAmount: Number(s.paidAmount ?? 0n),
      paid: s.paid,
    }))
    const factors = criteriaToFactors(
      scoring?.criteriaScores as Record<string, number> | null,
    )

    return {
      id: deal.id,
      dealNumber: formatDealNumber(deal.dealNumber),
      tenantId: deal.merchantId.toString(),
      clientName: client ? `${client.firstName} ${client.lastName}` : '—',
      clientPinfl: client?.pinfl ?? '—',
      clientPhone: client?.phone ?? '—',
      status: deal.status,
      amount: deal.amount != null ? Number(deal.amount) : 0,
      totalPayable: deal.totalPayable != null ? Number(deal.totalPayable) : 0,
      score: deal.scoreSum != null ? Number(deal.scoreSum) : 0,
      decision: deal.scoringDecision ?? 'manual_review',
      agentId: deal.agentId.toString(),
      agentName: agent?.fullName ?? '—',
      tariffName: tariff?.name ?? '—',
      termMonths: deal.termMonths ?? tariff?.termMonths ?? 0,
      createdAt: deal.createdAt.toISOString(),
      basket,
      schedule,
      factors,
    }
  })
}

// ---------------------------------------------------------------------------
// Get single deal by ID — full detail for the admin detail view
// ---------------------------------------------------------------------------

export async function getAdminDeal(db: Db, id: string) {
  const rows = await db
    .select({
      deal: deals,
      client: clients,
      tariff: tariffs,
      agent: merchantUsers,
      merchant: merchants,
    })
    .from(deals)
    .leftJoin(clients, eq(deals.clientId, clients.id))
    .leftJoin(tariffs, eq(deals.tariffId, tariffs.id))
    .leftJoin(merchantUsers, eq(deals.agentId, merchantUsers.id))
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .where(eq(deals.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const { deal, client, tariff, agent, merchant } = row

  const [itemRows, scheduleRows, scoringRows] = await Promise.all([
    db.select().from(dealItems).where(eq(dealItems.dealId, id)).orderBy(dealItems.id),
    db
      .select()
      .from(dealPaymentSchedules)
      .where(eq(dealPaymentSchedules.dealId, id))
      .orderBy(dealPaymentSchedules.index),
    db
      .select()
      .from(clientScorings)
      .where(eq(clientScorings.dealId, id))
      .orderBy(desc(clientScorings.scoredAt))
      .limit(1),
  ])

  const scoring = scoringRows[0]

  return {
    id: deal.id,
    dealNumber: formatDealNumber(deal.dealNumber),
    merchantId: deal.merchantId.toString(),
    merchantName: merchant?.name ?? '—',
    clientName: client ? `${client.firstName} ${client.lastName}` : '—',
    clientPinfl: client?.pinfl ?? '—',
    clientPhone: client?.phone ?? '—',
    status: deal.status,
    amount: deal.amount != null ? Number(deal.amount) : 0,
    totalPayable: deal.totalPayable != null ? Number(deal.totalPayable) : 0,
    termMonths: deal.termMonths ?? tariff?.termMonths ?? 0,
    paymentDay: deal.paymentDay ?? null,
    scoreSum: deal.scoreSum != null ? Number(deal.scoreSum) : null,
    scoringDecision: deal.scoringDecision ?? null,
    agentId: deal.agentId.toString(),
    agentName: agent?.fullName ?? '—',
    tariffName: tariff?.name ?? '—',
    createdAt: deal.createdAt.toISOString(),
    lang: deal.lang ?? 'ru',
    basket: itemRows.map((i) => ({
      productName: i.productName,
      tanNarxi: i.tanNarxi,
      mxikCode: i.mxikCode ?? null,
      quantity: i.quantity,
    })),
    schedule: scheduleRows.map((s) => ({
      index: s.index,
      dueDate: s.dueDate,
      amount: Number(s.amount),
      paidAmount: Number(s.paidAmount ?? 0n),
      paid: s.paid,
      paidAt: s.paidAt?.toISOString() ?? null,
    })),
    factors: criteriaToFactors(
      scoring?.criteriaScores as Record<string, number> | null,
    ),
  }
}

// ---------------------------------------------------------------------------
// Deal comments — list and create
// ---------------------------------------------------------------------------

export async function listDealComments(db: Db, dealId: string) {
  const rows = await db
    .select({
      id: dealComments.id,
      text: dealComments.text,
      createdAt: dealComments.createdAt,
      authorName: adminUsers.fullName,
    })
    .from(dealComments)
    .innerJoin(adminUsers, eq(dealComments.adminUserId, adminUsers.id))
    .where(eq(dealComments.dealId, dealId))
    .orderBy(asc(dealComments.createdAt))

  return rows.map((r) => ({
    id: r.id.toString(),
    text: r.text,
    createdAt: r.createdAt.toISOString(),
    authorName: r.authorName,
  }))
}

export async function createDealComment(
  db: Db,
  dealId: string,
  adminUserId: bigint,
  text: string,
) {
  const [row] = await db
    .insert(dealComments)
    .values({ dealId, adminUserId, text })
    .returning({
      id: dealComments.id,
      createdAt: dealComments.createdAt,
    })

  return { id: row!.id.toString(), dealId, text, createdAt: row!.createdAt.toISOString() }
}
