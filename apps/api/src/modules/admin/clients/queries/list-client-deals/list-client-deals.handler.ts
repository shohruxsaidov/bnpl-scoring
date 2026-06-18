import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { db } from '@db'
import { users, merchants, branches, tariffs } from '@db/schema'
import { deals } from "../../../../deals/schema"

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? `CN-${String(n).padStart(7, "0")}` : "—"
}

export async function listUserDeals(id: number) {
  const userRows = await db.select({ pinfl: users.pinfl }).from(users).where(eq(users.id, id)).limit(1)
  if (!userRows[0]) return []
  const pinfl = userRows[0].pinfl

  const allUserRows = await db.select({ id: users.id }).from(users).where(eq(users.pinfl, pinfl))
  const allUserIds = allUserRows.map((r) => r.id)
  if (allUserIds.length === 0) return []

  const rows = await db
    .select({ deal: deals, merchant: merchants, branch: branches, tariff: tariffs })
    .from(deals)
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .leftJoin(branches, eq(deals.branchId, branches.id))
    .leftJoin(tariffs, eq(deals.tariffId, tariffs.id))
    .where(and(inArray(deals.userId, allUserIds), sql`${deals.status} != 'draft'`))
    .orderBy(desc(deals.createdAt))

  return rows.map(({ deal, merchant, branch, tariff }) => ({
    id: deal.id,
    dealNumber: formatDealNumber(deal.dealNumber),
    merchantName: merchant?.name ?? "—",
    branchName: branch?.name ?? "—",
    status: deal.status,
    amount: deal.amount != null ? Number(deal.amount) : 0,
    totalPayable: deal.totalPayable != null ? Number(deal.totalPayable) : 0,
    tariffName: tariff?.name ?? "—",
    termMonths: deal.termMonths ?? tariff?.termMonths ?? 0,
    createdAt: deal.createdAt.toISOString(),
  }))
}
