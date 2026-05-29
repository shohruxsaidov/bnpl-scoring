import { and, count, eq, lte, not, inArray, sql } from 'drizzle-orm'
import type { Db } from '../../../db'
import { deals, dealPaymentSchedules } from '../../deals/db/schema'
import { clients } from '../../id/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverdueCard {
  dealId: string
  clientName: string
  clientPhone: string
  /** tiyin */
  principal: number
  missedCount: number
  daysOverdue: number
}

export interface AgingBucket {
  key: string
  cards: OverdueCard[]
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

const EXCLUDED_STATUSES = ['draft', 'scoring', 'declined', 'closed'] as const

export async function getCollectionBoard(db: Db, merchantId: bigint): Promise<AgingBucket[]> {
  const today = new Date().toISOString().slice(0, 10)

  const rows = await db
    .select({
      dealId: deals.id,
      firstName: clients.firstName,
      lastName: clients.lastName,
      clientPhone: clients.phone,
      principal: deals.amount,
      missedCount: count(dealPaymentSchedules.id),
      daysOverdue: sql<number>`max(${today}::date - ${dealPaymentSchedules.dueDate}::date)`,
    })
    .from(deals)
    .innerJoin(clients, eq(clients.id, deals.clientId))
    .innerJoin(dealPaymentSchedules, eq(dealPaymentSchedules.dealId, deals.id))
    .where(
      and(
        eq(deals.merchantId, merchantId),
        not(inArray(deals.status, [...EXCLUDED_STATUSES])),
        eq(dealPaymentSchedules.paid, false),
        lte(dealPaymentSchedules.dueDate, today),
      ),
    )
    .groupBy(
      deals.id,
      clients.firstName,
      clients.lastName,
      clients.phone,
      deals.amount,
    )

  const cards: OverdueCard[] = rows
    .filter((r) => Number(r.daysOverdue) > 0)
    .map((r) => ({
      dealId: r.dealId,
      clientName: `${r.firstName} ${r.lastName}`,
      clientPhone: r.clientPhone,
      principal: Number(r.principal ?? 0),
      missedCount: Number(r.missedCount),
      daysOverdue: Number(r.daysOverdue),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue)

  return [
    { key: '1-30', cards: cards.filter((c) => c.daysOverdue >= 1 && c.daysOverdue <= 30) },
    { key: '31-60', cards: cards.filter((c) => c.daysOverdue >= 31 && c.daysOverdue <= 60) },
    { key: '61-90', cards: cards.filter((c) => c.daysOverdue >= 61 && c.daysOverdue <= 90) },
    { key: '90+', cards: cards.filter((c) => c.daysOverdue > 90) },
  ]
}
