import { and, desc, eq, inArray } from 'drizzle-orm'
import type { Db } from '../../../db'
import { deals, dealItems, dealPaymentSchedules, clientScorings } from '../../deals/db/schema'
import { clients, tariffs, merchantUsers, merchants } from '../../id/db/schema'
import { notifyPaymentReceived } from '../../notifications/service'

// ---------------------------------------------------------------------------
// Criteria → human-readable label map
// ---------------------------------------------------------------------------

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
    if (!scoringByDeal.has(s.dealId)) scoringByDeal.set(s.dealId, s)
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
// Manually mark a payment schedule item as paid (test / admin use)
// Updates deal status: all paid → 'closed', any overdue unpaid → 'overdue'
// ---------------------------------------------------------------------------

export type ScheduleRow = {
  index: number
  dueDate: string
  amount: number
  paidAmount: number
  paid: boolean
  paidAt: string | null
}

export async function payScheduleItem(
  db: Db,
  dealId: string,
  scheduleIndex: number,
  payAmount: bigint,
): Promise<{ schedule: ScheduleRow[] }> {
  // Load current row
  const [row] = await db
    .select()
    .from(dealPaymentSchedules)
    .where(
      and(
        eq(dealPaymentSchedules.dealId, dealId),
        eq(dealPaymentSchedules.index, scheduleIndex),
      ),
    )
    .limit(1)

  if (!row) throw Object.assign(new Error('Schedule item not found'), { statusCode: 404 })
  if (row.paid) throw Object.assign(new Error('Already fully paid'), { statusCode: 409 })

  const newPaidAmount = (row.paidAmount ?? 0n) + payAmount
  const fullyPaid = newPaidAmount >= row.amount

  await db
    .update(dealPaymentSchedules)
    .set({
      paidAmount: newPaidAmount,
      paid: fullyPaid,
      paidAt: fullyPaid ? new Date() : row.paidAt,
    })
    .where(
      and(
        eq(dealPaymentSchedules.dealId, dealId),
        eq(dealPaymentSchedules.index, scheduleIndex),
      ),
    )

  // Reload all rows, recalculate deal status
  const rows = await db
    .select()
    .from(dealPaymentSchedules)
    .where(eq(dealPaymentSchedules.dealId, dealId))
    .orderBy(dealPaymentSchedules.index)

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const allPaid = rows.every((r) => r.paid)
  const hasOverdue = rows.some((r) => !r.paid && new Date(r.dueDate) < today)
  const newStatus = allPaid ? 'closed' : hasOverdue ? 'overdue' : 'active'

  await db.update(deals).set({ status: newStatus }).where(eq(deals.id, dealId))

  // Notify merchant admins / branch admins — fire-and-forget
  db.select({ merchantId: deals.merchantId, branchId: deals.branchId, clientId: deals.clientId })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1)
    .then(([deal]) => {
      if (!deal?.clientId) return
      notifyPaymentReceived(db, {
        dealId,
        merchantId: deal.merchantId,
        branchId: deal.branchId,
        clientId: deal.clientId,
        paidTiyin: payAmount,
        scheduleIndex,
        fullyPaid,
      }).catch(() => {})
    })
    .catch(() => {})

  return {
    schedule: rows.map((r) => ({
      index: r.index,
      dueDate: r.dueDate,
      amount: Number(r.amount),
      paidAmount: Number(r.paidAmount ?? 0n),
      paid: r.paid,
      paidAt: r.paidAt?.toISOString() ?? null,
    })),
  }
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
