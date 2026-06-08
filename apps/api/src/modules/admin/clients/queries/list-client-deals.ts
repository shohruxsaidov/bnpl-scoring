import { and, desc, eq, inArray, sql } from "drizzle-orm"
import type { Db } from "../../../../db"
import { clients, merchants, branches, tariffs } from "../../../id/db/schema"
import { deals } from "../../../deals/db/schema"

function formatDealNumber(n: bigint | null | undefined): string {
  return n != null ? `CN-${String(n).padStart(7, "0")}` : "—"
}

export async function listClientDeals(db: Db, id: bigint) {
  const clientRows = await db.select({ pinfl: clients.pinfl }).from(clients).where(eq(clients.id, id)).limit(1)
  if (!clientRows[0]) return []
  const pinfl = clientRows[0].pinfl

  const allClientRows = await db.select({ id: clients.id }).from(clients).where(eq(clients.pinfl, pinfl))
  const allClientIds = allClientRows.map((r) => r.id)
  if (allClientIds.length === 0) return []

  const rows = await db
    .select({ deal: deals, merchant: merchants, branch: branches, tariff: tariffs })
    .from(deals)
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .leftJoin(branches, eq(deals.branchId, branches.id))
    .leftJoin(tariffs, eq(deals.tariffId, tariffs.id))
    .where(and(inArray(deals.clientId, allClientIds), sql`${deals.status} != 'draft'`))
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
