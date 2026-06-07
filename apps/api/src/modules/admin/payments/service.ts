import { and, asc, desc, eq, gt, or, sql } from 'drizzle-orm'
import type { Db } from '../../../db'
import { deals, dealPaymentSchedules, manualPayments, dealComments } from '../../deals/db/schema'
import { clients, merchants, adminUsers } from '../../id/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Payment {
  id: string
  merchantId: string
  merchantName: string
  clientName: string
  clientPhone: string
  contractId: string
  dealNumber: string
  /** tiyin */
  amount: number
  /** tiyin — amount paid so far (> 0 and < amount when partial) */
  paidAmount: number
  type: 'cash' | 'card' | 'transfer'
  status: 'confirmed' | 'pending' | 'partial' | 'cancelled'
  /** ISO date string — paid date if present, else due date */
  date: string
  paymentProvider: string[] | null
}

export interface ManualPayment {
  id: string
  dealId: string
  dealNumber: string
  clientName: string
  clientPhone: string
  amount: number
  paymentType: string
  note: string | null
  createdAt: string
  adminName: string | null
}

export interface DealSearchResult {
  id: string
  dealNumber: string
  clientName: string
  clientPhone: string
  remainingAmount: number
}

// ---------------------------------------------------------------------------
// List payments (installment schedule rows) across all merchants.
// Optional merchantId filter.
//
// The deal_payment_schedules table only tracks a `paid` boolean (no payment
// method column and no cancelled/void state), so:
//   - status: paid === true → 'confirmed', otherwise 'pending'
//   - type: defaults to 'transfer' (no payment-method column exists yet)
// ---------------------------------------------------------------------------

export async function listPayments(
  db: Db,
  filters: { merchantId?: bigint } = {},
): Promise<Payment[]> {
  let query = db
    .select({
      id: dealPaymentSchedules.id,
      contractId: deals.id,
      dealNumber: deals.dealNumber,
      merchantId: deals.merchantId,
      merchantName: merchants.name,
      firstName: clients.firstName,
      lastName: clients.lastName,
      clientPhone: clients.phone,
      amount: dealPaymentSchedules.amount,
      paidAmount: dealPaymentSchedules.paidAmount,
      paid: dealPaymentSchedules.paid,
      paidAt: dealPaymentSchedules.paidAt,
      dueDate: dealPaymentSchedules.dueDate,
      paymentProvider: dealPaymentSchedules.paymentProvider,
    })
    .from(dealPaymentSchedules)
    .innerJoin(deals, eq(dealPaymentSchedules.dealId, deals.id))
    .innerJoin(clients, eq(clients.id, deals.clientId))
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .orderBy(desc(dealPaymentSchedules.dueDate))
    .$dynamic()

  const notPending = or(eq(dealPaymentSchedules.paid, true), gt(dealPaymentSchedules.paidAmount, 0n))!

  if (filters.merchantId) {
    query = query.where(and(notPending, eq(deals.merchantId, filters.merchantId)))
  } else {
    query = query.where(notPending)
  }

  const rows = await query

  return rows.map((r) => ({
    id: r.id.toString(),
    merchantId: r.merchantId.toString(),
    merchantName: r.merchantName ?? '—',
    clientName: `${r.firstName} ${r.lastName}`,
    clientPhone: r.clientPhone,
    contractId: r.contractId,
    dealNumber: `CN-${String(r.dealNumber ?? 0).padStart(7, '0')}`,
    amount: Number(r.amount),
    paidAmount: Number(r.paidAmount ?? 0n),
    type: 'transfer' as const,
    status: r.paid
      ? ('confirmed' as const)
      : Number(r.paidAmount ?? 0n) > 0
        ? ('partial' as const)
        : ('pending' as const),
    date: r.paidAt ? r.paidAt.toISOString() : new Date(`${r.dueDate}T00:00:00.000Z`).toISOString(),
    paymentProvider: r.paymentProvider ?? null,
  }))
}

// ---------------------------------------------------------------------------
// Search active deals by deal number prefix (strips CN- prefix if present).
// Returns up to 10 results with remaining balance per deal.
// ---------------------------------------------------------------------------

export async function searchDealsForManualPayment(
  db: Db,
  q: string,
): Promise<DealSearchResult[]> {
  const stripped = q.replace(/^CN-0*/i, '').trim()
  if (!stripped) return []

  const dealRows = await db
    .select({
      id: deals.id,
      dealNumber: deals.dealNumber,
      firstName: clients.firstName,
      lastName: clients.lastName,
      phone: clients.phone,
    })
    .from(deals)
    .innerJoin(clients, eq(clients.id, deals.clientId))
    .where(
      and(
        sql`deals.status NOT IN ('draft', 'declined')`,
        sql`deals.deal_number::text LIKE ${stripped + '%'}`,
      ),
    )
    .limit(10)

  if (dealRows.length === 0) return []

  return Promise.all(
    dealRows.map(async (d) => {
      const scheduleRows = await db
        .select({ amount: dealPaymentSchedules.amount, paidAmount: dealPaymentSchedules.paidAmount })
        .from(dealPaymentSchedules)
        .where(and(eq(dealPaymentSchedules.dealId, d.id), eq(dealPaymentSchedules.paid, false)))

      const remaining = scheduleRows.reduce(
        (sum, r) => sum + Number(r.amount) - Number(r.paidAmount ?? 0n),
        0,
      )

      return {
        id: d.id,
        dealNumber: `CN-${String(d.dealNumber).padStart(7, '0')}`,
        clientName: `${d.firstName} ${d.lastName}`,
        clientPhone: d.phone,
        remainingAmount: remaining,
      }
    }),
  )
}

// ---------------------------------------------------------------------------
// List all manual payments, newest first.
// ---------------------------------------------------------------------------

export async function listManualPayments(db: Db): Promise<ManualPayment[]> {
  const rows = await db
    .select({
      id: manualPayments.id,
      dealId: manualPayments.dealId,
      dealNumber: deals.dealNumber,
      amount: manualPayments.amount,
      paymentType: manualPayments.paymentType,
      note: manualPayments.note,
      createdAt: manualPayments.createdAt,
      firstName: clients.firstName,
      lastName: clients.lastName,
      clientPhone: clients.phone,
      adminName: adminUsers.fullName,
    })
    .from(manualPayments)
    .innerJoin(deals, eq(manualPayments.dealId, deals.id))
    .innerJoin(clients, eq(clients.id, deals.clientId))
    .leftJoin(adminUsers, eq(manualPayments.adminUserId, adminUsers.id))
    .orderBy(desc(manualPayments.createdAt))

  return rows.map((r) => ({
    id: r.id.toString(),
    dealId: r.dealId,
    dealNumber: `CN-${String(r.dealNumber).padStart(7, '0')}`,
    clientName: `${r.firstName} ${r.lastName}`,
    clientPhone: r.clientPhone,
    amount: Number(r.amount),
    paymentType: r.paymentType,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    adminName: r.adminName ?? null,
  }))
}

// ---------------------------------------------------------------------------
// Create a manual payment.
//
// Algorithm (single transaction):
//  1. Validate amount ≤ total remaining unpaid balance → 400 if over
//  2. Insert manual_payments row
//  3. Walk unpaid schedule rows FIFO by dueDate:
//     - distribute amount, update paidAmount, paid, paidAt, manual_payment_id
//  4. If all rows now paid → set deal status = 'closed'
//  5. If note non-empty → insert deal_comments row
// ---------------------------------------------------------------------------

export async function createManualPayment(
  db: Db,
  input: {
    dealId: string
    adminUserId: bigint
    amount: number
    paymentType: string
    note?: string
  },
): Promise<ManualPayment> {
  return db.transaction(async (tx) => {
    const amountTiyin = BigInt(input.amount)

    // 1. Load unpaid rows ordered by dueDate ASC
    const unpaid = await tx
      .select()
      .from(dealPaymentSchedules)
      .where(and(eq(dealPaymentSchedules.dealId, input.dealId), eq(dealPaymentSchedules.paid, false)))
      .orderBy(asc(dealPaymentSchedules.dueDate))

    const totalRemaining = unpaid.reduce(
      (sum, r) => sum + (r.amount - (r.paidAmount ?? 0n)),
      0n,
    )

    if (amountTiyin > totalRemaining) {
      throw Object.assign(new Error('overpayment'), { statusCode: 400, code: 'OVERPAYMENT' })
    }

    // 2. Insert manual_payments row
    const mpRows = await tx
      .insert(manualPayments)
      .values({
        dealId: input.dealId,
        adminUserId: input.adminUserId,
        amount: amountTiyin,
        paymentType: input.paymentType,
        note: input.note || null,
      })
      .returning()
    const mp = mpRows[0]!

    // 3. Distribute FIFO
    let bucket = amountTiyin
    const now = new Date()

    for (const row of unpaid) {
      if (bucket <= 0n) break
      const rowRemaining = row.amount - (row.paidAmount ?? 0n)
      const apply = bucket < rowRemaining ? bucket : rowRemaining
      const newPaid = (row.paidAmount ?? 0n) + apply
      const fullyPaid = newPaid >= row.amount

      await tx
        .update(dealPaymentSchedules)
        .set({
          paidAmount: newPaid,
          paid: fullyPaid,
          paidAt: fullyPaid ? now : null,
          manualPaymentId: mp.id,
          paymentProvider: sql`array_append(COALESCE(${dealPaymentSchedules.paymentProvider}, ARRAY[]::text[]), 'manual')`,
        })
        .where(eq(dealPaymentSchedules.id, row.id))

      bucket -= apply
    }

    // 4. Check if deal is now fully paid
    const stillUnpaid = await tx
      .select({ id: dealPaymentSchedules.id })
      .from(dealPaymentSchedules)
      .where(and(eq(dealPaymentSchedules.dealId, input.dealId), eq(dealPaymentSchedules.paid, false)))
      .limit(1)

    if (stillUnpaid.length === 0) {
      await tx.update(deals).set({ status: 'closed' }).where(eq(deals.id, input.dealId))
    }

    // 5. Auto-comment
    if (input.note) {
      await tx.insert(dealComments).values({
        dealId: input.dealId,
        adminUserId: input.adminUserId,
        text: `Ручной платёж: ${input.note}`,
      })
    }

    // Return full shape
    const dealRows = await tx
      .select({ dealNumber: deals.dealNumber, clientId: deals.clientId })
      .from(deals)
      .where(eq(deals.id, input.dealId))
    const deal = dealRows[0]!

    const clientRows = await tx
      .select({ firstName: clients.firstName, lastName: clients.lastName, phone: clients.phone })
      .from(clients)
      .where(eq(clients.id, deal.clientId!))
    const client = clientRows[0]!

    const adminRows = await tx
      .select({ fullName: adminUsers.fullName })
      .from(adminUsers)
      .where(eq(adminUsers.id, input.adminUserId))
    const admin = adminRows[0]

    return {
      id: mp.id.toString(),
      dealId: mp.dealId,
      dealNumber: `CN-${String(deal.dealNumber).padStart(7, '0')}`,
      clientName: `${client.firstName} ${client.lastName}`,
      clientPhone: client.phone,
      amount: Number(mp.amount),
      paymentType: mp.paymentType,
      note: mp.note,
      createdAt: mp.createdAt.toISOString(),
      adminName: admin?.fullName ?? null,
    }
  })
}
