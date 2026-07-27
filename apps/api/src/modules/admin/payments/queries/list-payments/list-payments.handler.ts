import { and, asc, desc, eq, gte, lte, or, sql, type SQL } from "drizzle-orm"
import { db } from "@db"
import { deals, dealPayments, type DealPaymentSource } from "../../../../deals/schema"
import { users, merchants, adminUsers } from '@db/schema'
import type { ListPaymentsFilters } from './list-payments.query'

// ---------------------------------------------------------------------------
// The payments register: one row per money-in event, whatever the rail.
//
// It reads deal_payments, NOT deal_payment_schedules. The distinction matters:
// a schedule row is an instalment the deal owes, a deal_payments row is money
// that actually arrived. A row only exists once the money landed — Payme books
// in PerformTransaction, Plum after the OTP clears, manual when an operator
// records it — so there is no per-row status to show. Money that has NOT landed
// lives in payme_transactions and plum_payment_sessions, each with its own
// screen. `source` is the only categorical fact a row carries.
//
// The same filters feed two statements: the page and the aggregate behind the
// KPI strip. The totals therefore describe the whole filtered set, not the
// visible page — an operator who filters to one day and one rail reads the sum
// for that day and rail straight off the cards.
// ---------------------------------------------------------------------------

export interface Payment {
  id: string
  dealId: string
  dealNumber: string
  merchantId: string
  merchantName: string
  clientName: string
  clientPhone: string
  /** Amount in som. */
  amount: number
  source: DealPaymentSource
  paymentType: string
  note: string | null
  /** Null for machine-booked rows — nobody signed off on a Payme or Plum payment. */
  adminName: string | null
  /** Value date, `YYYY-MM-DD` — the day the money moved. */
  paymentDate: string
  /** Booking instant. Diverges from paymentDate exactly when a human backdated. */
  createdAt: string
}

export interface PaymentTotals {
  count: number
  /** Som across the whole filtered set. */
  volume: number
  bySource: Record<DealPaymentSource, number>
}

export interface ListPaymentsResult {
  payments: Payment[]
  /** Rows matching the filters, for the paginator. */
  total: number
  totals: PaymentTotals
}

const DEFAULT_LIMIT = 25
const MAX_LIMIT = 100

/**
 * LIKE treats `%` and `_` as wildcards, so a client whose name contains one
 * would otherwise widen their own search. Backslash is postgres' default
 * escape character.
 */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, (c) => `\\${c}`)
}

function buildWhere(filters: ListPaymentsFilters): SQL | undefined {
  const clauses: SQL[] = []

  if (filters.merchantId) clauses.push(eq(deals.merchantId, filters.merchantId))
  if (filters.source) clauses.push(eq(dealPayments.source, filters.source))
  if (filters.dateFrom) clauses.push(gte(dealPayments.paymentDate, filters.dateFrom))
  if (filters.dateTo) clauses.push(lte(dealPayments.paymentDate, filters.dateTo))

  const q = filters.q?.trim()
  if (q) {
    const like = `%${escapeLike(q)}%`
    const matches: SQL[] = [
      sql`(${users.firstName} || ' ' || ${users.lastName}) ILIKE ${like}`,
      sql`${users.phone} ILIKE ${like}`,
    ]
    // Deal numbers are integers, so only a digit run can prefix-match one.
    // Running it on "иван" would cost a cast per row for a guaranteed miss.
    if (/^\d+$/.test(q)) {
      matches.push(sql`${deals.dealNumber}::text LIKE ${`${q}%`}`)
    }
    clauses.push(or(...matches)!)
  }

  return clauses.length > 0 ? and(...clauses) : undefined
}

export async function listPayments(
  filters: ListPaymentsFilters = {},
): Promise<ListPaymentsResult> {
  const where = buildWhere(filters)
  const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT)
  const offset = Math.max(filters.page ?? 0, 0) * limit

  const direction = filters.sortDir === 'asc' ? asc : desc
  const sortColumn =
    filters.sortBy === 'amount' ? dealPayments.amount : dealPayments.paymentDate

  const rows = await db
    .select({
      id: dealPayments.id,
      dealId: dealPayments.dealId,
      dealNumber: deals.dealNumber,
      merchantId: deals.merchantId,
      merchantName: merchants.name,
      firstName: users.firstName,
      lastName: users.lastName,
      clientPhone: users.phone,
      amount: dealPayments.amount,
      source: dealPayments.source,
      paymentType: dealPayments.paymentType,
      note: dealPayments.note,
      adminName: adminUsers.fullName,
      paymentDate: dealPayments.paymentDate,
      createdAt: dealPayments.createdAt,
    })
    .from(dealPayments)
    .innerJoin(deals, eq(dealPayments.dealId, deals.id))
    .innerJoin(users, eq(users.id, deals.userId))
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .leftJoin(adminUsers, eq(dealPayments.adminUserId, adminUsers.id))
    .where(where)
    // id breaks ties: a bare date sorts unstably for same-day rows, which
    // shuffles them between page reads and can drop or repeat one at a boundary.
    .orderBy(direction(sortColumn), desc(dealPayments.id))
    .limit(limit)
    .offset(offset)

  // Same joins as the page — the filters reach across deals and users, so the
  // aggregate cannot be narrowed to deal_payments alone.
  const volumeWhere = (source: DealPaymentSource) =>
    sql<string>`coalesce(sum(${dealPayments.amount}) filter (where ${dealPayments.source} = ${source}), 0)`

  const [agg] = await db
    .select({
      count: sql<string>`count(*)`,
      volume: sql<string>`coalesce(sum(${dealPayments.amount}), 0)`,
      manual: volumeWhere('manual'),
      payme: volumeWhere('payme'),
      plum: volumeWhere('plum'),
    })
    .from(dealPayments)
    .innerJoin(deals, eq(dealPayments.dealId, deals.id))
    .innerJoin(users, eq(users.id, deals.userId))
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .where(where)

  const total = Number(agg?.count ?? 0)

  return {
    payments: rows.map((r) => ({
      id: String(r.id),
      dealId: r.dealId,
      dealNumber: String(r.dealNumber ?? 0),
      merchantId: String(r.merchantId),
      merchantName: r.merchantName ?? '—',
      clientName: `${r.firstName} ${r.lastName}`,
      clientPhone: r.clientPhone,
      amount: Number(r.amount),
      source: r.source,
      paymentType: r.paymentType,
      note: r.note,
      adminName: r.adminName ?? null,
      paymentDate: r.paymentDate,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    totals: {
      count: total,
      volume: Number(agg?.volume ?? 0),
      bySource: {
        manual: Number(agg?.manual ?? 0),
        payme: Number(agg?.payme ?? 0),
        plum: Number(agg?.plum ?? 0),
      },
    },
  }
}
