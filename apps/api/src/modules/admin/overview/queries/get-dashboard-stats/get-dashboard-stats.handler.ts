import { count, eq, ne } from "drizzle-orm"
import { db } from '@db'
import { deals } from "../../../../deals/schema"
import { merchants } from '@db/schema'

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
