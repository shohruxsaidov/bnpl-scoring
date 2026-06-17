import { desc, eq, inArray } from "drizzle-orm"
import type { Db } from "../../../../db"
import { buyouts, deals, dealItems } from "../../../deals/db/schema"
import { merchants, branches, merchantUsers, clients } from "../../../id/db/schema"

export interface BuyoutItemDto {
  productName: string
  price: number
  qty: number
  amount: number
}

export interface BuyoutDto {
  id: string
  dealId: string
  dealNumber: string
  merchantId: string
  merchantName: string
  branchName: string
  agentName: string
  clientName: string
  clientPhone: string
  amount: number
  status: string
  createdAt: string
  items: BuyoutItemDto[]
}

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? `CN-${String(n).padStart(7, "0")}` : "—"
}

export async function listBuyouts(
  db: Db,
  filters: { merchantId?: number; status?: string } = {},
): Promise<BuyoutDto[]> {
  let query = db
    .select({
      buyout: buyouts,
      deal: { dealNumber: deals.dealNumber },
      merchant: { id: merchants.id, name: merchants.name },
      branch: { name: branches.name },
      agent: { fullName: merchantUsers.fullName },
      client: { firstName: clients.firstName, lastName: clients.lastName, phone: clients.phone },
    })
    .from(buyouts)
    .leftJoin(deals, eq(buyouts.dealId, deals.id))
    .leftJoin(merchants, eq(buyouts.merchantId, merchants.id))
    .leftJoin(branches, eq(buyouts.branchId, branches.id))
    .leftJoin(merchantUsers, eq(deals.agentId, merchantUsers.id))
    .leftJoin(clients, eq(deals.clientId, clients.id))
    .orderBy(desc(buyouts.createdAt))
    .$dynamic()

  if (filters.merchantId) {
    query = query.where(eq(buyouts.merchantId, filters.merchantId))
  }
  if (filters.status) {
    query = query.where(eq(buyouts.status, filters.status))
  }

  const rows = await query

  const dealIds = rows.map((r) => r.buyout.dealId)
  const itemRows = dealIds.length > 0
    ? await db.select().from(dealItems).where(inArray(dealItems.dealId, dealIds))
    : []

  const itemsByDeal = new Map<string, typeof itemRows>()
  for (const item of itemRows) {
    const arr = itemsByDeal.get(item.dealId) ?? []
    arr.push(item)
    itemsByDeal.set(item.dealId, arr)
  }

  return rows.map((r) => ({
    id: String(r.buyout.id),
    dealId: r.buyout.dealId,
    dealNumber: formatDealNumber(r.deal?.dealNumber ?? null),
    merchantId: String(r.buyout.merchantId),
    merchantName: r.merchant?.name ?? "—",
    branchName: r.branch?.name ?? "—",
    agentName: r.agent?.fullName ?? "—",
    clientName: r.client ? `${r.client.lastName} ${r.client.firstName}` : "—",
    clientPhone: r.client?.phone ?? "—",
    amount: Number(r.buyout.amount),
    status: r.buyout.status,
    createdAt: r.buyout.createdAt.toISOString(),
    items: (itemsByDeal.get(r.buyout.dealId) ?? []).map((i) => {
      const price = Math.round(parseFloat(i.price) * 100)
      return { productName: i.productName, price, qty: i.quantity, amount: price * i.quantity }
    }),
  }))
}
