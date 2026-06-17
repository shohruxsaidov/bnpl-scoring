import { and, count, eq, lte, not, inArray, sql } from "drizzle-orm"
import type { Db } from "../../../../db"
import { deals, dealPaymentSchedules } from "../../../deals/db/schema"
import { clients, merchants } from "../../../id/db/schema"

export interface OverdueCard {
  dealId: string
  dealNumber: string
  merchantId: string
  merchantName: string
  clientName: string
  clientPhone: string
  principal: number
  missedCount: number
  daysOverdue: number
}

export interface AgingBucket {
  key: string
  cards: OverdueCard[]
}

const EXCLUDED_STATUSES = ["draft", "scoring", "declined", "closed"] as const

export async function getCollectionBoard(
  db: Db,
  filters: { merchantId?: number } = {},
): Promise<AgingBucket[]> {
  const today = new Date().toISOString().slice(0, 10)

  const where = [
    not(inArray(deals.status, [...EXCLUDED_STATUSES])),
    eq(dealPaymentSchedules.paid, false),
    lte(dealPaymentSchedules.dueDate, today),
  ]
  if (filters.merchantId) {
    where.push(eq(deals.merchantId, filters.merchantId))
  }

  const rows = await db
    .select({
      dealId: deals.id,
      dealNumber: deals.dealNumber,
      merchantId: deals.merchantId,
      merchantName: merchants.name,
      firstName: clients.firstName,
      lastName: clients.lastName,
      clientPhone: clients.phone,
      principal: deals.amount,
      missedCount: count(dealPaymentSchedules.id),
      daysOverdue: sql<number>`max(${today}::date - ${dealPaymentSchedules.dueDate}::date)`,
    })
    .from(deals)
    .innerJoin(clients, eq(clients.id, deals.clientId))
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .innerJoin(dealPaymentSchedules, eq(dealPaymentSchedules.dealId, deals.id))
    .where(and(...where))
    .groupBy(
      deals.id,
      deals.dealNumber,
      deals.merchantId,
      merchants.name,
      clients.firstName,
      clients.lastName,
      clients.phone,
      deals.amount,
    )

  const cards: OverdueCard[] = rows
    .filter((r) => Number(r.daysOverdue) > 0)
    .map((r) => ({
      dealId: r.dealId,
      dealNumber: r.dealNumber != null ? `CN-${String(r.dealNumber).padStart(7, "0")}` : "—",
      merchantId: r.merchantId.toString(),
      merchantName: r.merchantName ?? "—",
      clientName: `${r.firstName} ${r.lastName}`,
      clientPhone: r.clientPhone,
      principal: Number(r.principal ?? 0),
      missedCount: Number(r.missedCount),
      daysOverdue: Number(r.daysOverdue),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue)

  return [
    { key: "1-30", cards: cards.filter((c) => c.daysOverdue >= 1 && c.daysOverdue <= 30) },
    { key: "31-60", cards: cards.filter((c) => c.daysOverdue >= 31 && c.daysOverdue <= 60) },
    { key: "61-90", cards: cards.filter((c) => c.daysOverdue >= 61 && c.daysOverdue <= 90) },
    { key: "90+", cards: cards.filter((c) => c.daysOverdue > 90) },
  ]
}
