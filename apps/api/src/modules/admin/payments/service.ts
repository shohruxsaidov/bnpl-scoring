import { and, desc, eq } from 'drizzle-orm'
import type { Db } from '../../../db'
import { deals, dealPaymentSchedules } from '../../deals/db/schema'
import { clients, merchants } from '../../id/db/schema'

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
  /** tiyin */
  amount: number
  type: 'cash' | 'card' | 'transfer'
  status: 'confirmed' | 'pending' | 'cancelled'
  /** ISO date string — paid date if present, else due date */
  date: string
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
      merchantId: deals.merchantId,
      merchantName: merchants.name,
      firstName: clients.firstName,
      lastName: clients.lastName,
      clientPhone: clients.phone,
      amount: dealPaymentSchedules.amount,
      paid: dealPaymentSchedules.paid,
      paidAt: dealPaymentSchedules.paidAt,
      dueDate: dealPaymentSchedules.dueDate,
    })
    .from(dealPaymentSchedules)
    .innerJoin(deals, eq(dealPaymentSchedules.dealId, deals.id))
    .innerJoin(clients, eq(clients.id, deals.clientId))
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .orderBy(desc(dealPaymentSchedules.dueDate))
    .$dynamic()

  if (filters.merchantId) {
    query = query.where(eq(deals.merchantId, filters.merchantId))
  }

  const rows = await query

  return rows.map((r) => ({
    id: r.id.toString(),
    merchantId: r.merchantId.toString(),
    merchantName: r.merchantName ?? '—',
    clientName: `${r.firstName} ${r.lastName}`,
    clientPhone: r.clientPhone,
    contractId: r.contractId,
    amount: Number(r.amount),
    type: 'transfer' as const,
    status: r.paid ? ('confirmed' as const) : ('pending' as const),
    date: r.paidAt ? r.paidAt.toISOString() : new Date(`${r.dueDate}T00:00:00.000Z`).toISOString(),
  }))
}
