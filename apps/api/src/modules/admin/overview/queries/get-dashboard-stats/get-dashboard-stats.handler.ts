import { and, count, eq, inArray, ne, sql } from "drizzle-orm"
import { db } from '@db'
import { deals, dealPaymentSchedules } from "../../../../deals/schema"
import { BLOCKING_DEAL_STATUSES } from "../../../../deals/blocking"
import { merchants } from '@db/schema'

/**
 * Deals whose term has fully elapsed — not one unpaid installment is still in the
 * future — yet which are still open.
 *
 * This number used to be nobody's problem. It is now the only thing standing
 * between a client and their next purchase: a deal closes when an admin records
 * its final payment, and nothing else in the system closes one — no ageing job,
 * no auto-debit. So for as long as a deal sits here, its client cannot score and
 * cannot buy from ANY merchant on the platform, and every day of that is a day of
 * sales lost across all of them.
 *
 * Each of these is either a payment someone collected and never entered, or a
 * client who genuinely stopped paying. We cannot tell the two apart from here —
 * both need an admin to look.
 */
export async function getStuckDealCount(): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(deals)
    .where(
      and(
        inArray(deals.status, [...BLOCKING_DEAL_STATUSES]),
        // No unpaid installment still to fall due — i.e. the schedule has run out.
        sql`not exists (
          select 1 from ${dealPaymentSchedules} s
           where s.deal_id = ${deals.id}
             and s.paid = false
             and s.due_date >= current_date
        )`,
      ),
    )
  return Number(row?.n ?? 0)
}

export async function getKybStats() {
  const rows = await db
    .select({ kybStatus: merchants.kybStatus, n: count() })
    .from(merchants)
    .groupBy(merchants.kybStatus)

  const map = new Map(rows.map((r) => [r.kybStatus, Number(r.n)]))
  return {
    pending: map.get("pending") ?? 0,
    verified: map.get("verified") ?? 0,
    rejected: map.get("rejected") ?? 0,
  }
}

export async function getMerchantHealth() {
  const [dealCounts, overdueCounts, allMerchants] = await Promise.all([
    db
      .select({ merchantId: deals.merchantId, n: count() })
      .from(deals)
      .where(ne(deals.status, "draft"))
      .groupBy(deals.merchantId),
    db
      .select({ merchantId: deals.merchantId, n: count() })
      .from(deals)
      .where(eq(deals.status, "overdue"))
      .groupBy(deals.merchantId),
    db.select({ id: merchants.id, name: merchants.name, active: merchants.active }).from(merchants),
  ])

  const dealMap = new Map(dealCounts.map((r) => [r.merchantId.toString(), Number(r.n)]))
  const overdueMap = new Map(overdueCounts.map((r) => [r.merchantId.toString(), Number(r.n)]))

  return allMerchants
    .map((m) => ({
      id: m.id.toString(),
      name: m.name,
      active: m.active,
      dealCount: dealMap.get(m.id.toString()) ?? 0,
      overdueCount: overdueMap.get(m.id.toString()) ?? 0,
    }))
    .sort((a, b) => b.dealCount - a.dealCount)
}
