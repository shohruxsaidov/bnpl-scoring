import { and, desc, eq } from 'drizzle-orm'
import type { Db } from '../../../db'
import { deals, dealItems, dealPaymentSchedules } from '../../deals/db/schema'
import { clients, tariffs, merchantUsers } from '../../id/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateDealInput {
  merchantId: bigint
  branchId: bigint
  agentId: bigint
  clientId: bigint
  tariffId: bigint
  basket: Array<{
    productId: bigint
    productName: string
    tanNarxi: string // decimal string e.g. "1500000.00"
    mxikCode: string | null
    packageCode: number | null
    packageName: string | null
    quantity: number
  }>
  paymentDay: number
  /** Tiyin */
  amount: bigint
  /** Tiyin */
  totalPayable: bigint
  termMonths: number
  markupPercent: number
  scoreSum: number | null
  scoringDecision: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function serializeBigInt(v: bigint | null | undefined): string | null {
  return v == null ? null : v.toString()
}

function toDealDto(
  d: typeof deals.$inferSelect,
  c: typeof clients.$inferSelect | null,
  t: typeof tariffs.$inferSelect | null,
  agentName: string,
) {
  return {
    id: d.id,
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    paymentDay: d.paymentDay,
    amount: d.amount != null ? Number(d.amount) : 0,
    totalPayable: d.totalPayable != null ? Number(d.totalPayable) : 0,
    termMonths: d.termMonths ?? t?.termMonths ?? 0,
    agentId: serializeBigInt(d.agentId),
    agentName,
    // client
    clientId: serializeBigInt(d.clientId),
    clientName: c ? `${c.firstName} ${c.lastName}` : null,
    clientPinfl: c?.pinfl ?? null,
    clientPhone: c?.phone ?? null,
    // tariff
    tariffId: serializeBigInt(d.tariffId),
    tariffName: t?.name ?? null,
    // scoring
    scoreSum: d.scoreSum != null ? Number(d.scoreSum) : null,
    scoringDecision: d.scoringDecision ?? null,
  }
}

// ---------------------------------------------------------------------------
// Create deal
// ---------------------------------------------------------------------------

export async function createDeal(db: Db, input: CreateDealInput) {
  // Run in a transaction so items + schedule are atomic
  return db.transaction(async (tx) => {
    // 1. Insert deal
    const [deal] = await tx
      .insert(deals)
      .values({
        merchantId: input.merchantId,
        branchId: input.branchId,
        agentId: input.agentId,
        clientId: input.clientId,
        tariffId: input.tariffId,
        paymentDay: input.paymentDay,
        amount: input.amount,
        totalPayable: input.totalPayable,
        termMonths: input.termMonths,
        scoreSum: input.scoreSum?.toString() ?? null,
        scoringDecision: input.scoringDecision ?? null,
        status: 'active',
      })
      .returning()

    if (!deal) throw new Error('deal_insert_failed')

    // 2. Insert deal items
    if (input.basket.length > 0) {
      await tx.insert(dealItems).values(
        input.basket.map((item) => ({
          dealId: deal.id,
          productId: item.productId,
          productName: item.productName,
          tanNarxi: item.tanNarxi,
          mxikCode: item.mxikCode,
          packageCode: item.packageCode,
          packageName: item.packageName,
          quantity: item.quantity,
        })),
      )
    }

    // 3. Generate payment schedule
    const monthlyRaw = Number(input.totalPayable) / input.termMonths
    const monthly = Math.round(monthlyRaw)
    const lastMonthly =
      Number(input.totalPayable) - monthly * (input.termMonths - 1)

    const now = new Date()
    const scheduleRows = Array.from({ length: input.termMonths }, (_, i) => {
      const due = new Date(now.getFullYear(), now.getMonth() + i + 1, input.paymentDay)
      const amount = i === input.termMonths - 1 ? lastMonthly : monthly
      return {
        dealId: deal.id,
        index: i + 1,
        dueDate: due.toISOString().slice(0, 10), // 'YYYY-MM-DD'
        amount: BigInt(amount),
        paid: false,
      }
    })

    await tx.insert(dealPaymentSchedules).values(scheduleRows)

    return deal
  })
}

// ---------------------------------------------------------------------------
// List deals  (for the merchant — scoped by merchantId, optionally by agentId)
// ---------------------------------------------------------------------------

export async function listDeals(db: Db, merchantId: bigint, agentId?: bigint) {
  const filter = agentId
    ? and(eq(deals.merchantId, merchantId), eq(deals.agentId, agentId))
    : eq(deals.merchantId, merchantId)

  const rows = await db
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
    .where(filter)
    .orderBy(desc(deals.createdAt))

  return rows
    .filter((r) => r.deal.status !== 'draft')
    .map((r) => toDealDto(r.deal, r.client, r.tariff, r.agent?.fullName ?? ''))
}

// ---------------------------------------------------------------------------
// Get deal by ID  (includes basket + schedule)
// ---------------------------------------------------------------------------

export async function getDealById(db: Db, id: string, merchantId: bigint) {
  const rows = await db
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
    .where(and(eq(deals.id, id), eq(deals.merchantId, merchantId)))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const base = toDealDto(row.deal, row.client, row.tariff, row.agent?.fullName ?? '')

  // Fetch basket and schedule in parallel
  const [items, schedule] = await Promise.all([
    db
      .select()
      .from(dealItems)
      .where(eq(dealItems.dealId, id))
      .orderBy(dealItems.id),
    db
      .select()
      .from(dealPaymentSchedules)
      .where(eq(dealPaymentSchedules.dealId, id))
      .orderBy(dealPaymentSchedules.index),
  ])

  return {
    ...base,
    basket: items.map((item) => ({
      productId: serializeBigInt(item.productId),
      productName: item.productName,
      tanNarxi: item.tanNarxi,
      mxikCode: item.mxikCode,
      packageCode: item.packageCode,
      packageName: item.packageName,
      quantity: item.quantity,
    })),
    schedule: schedule.map((s) => ({
      index: s.index,
      dueDate: s.dueDate,
      amount: Number(s.amount),
      paid: s.paid,
      paidAt: s.paidAt?.toISOString() ?? null,
    })),
  }
}
