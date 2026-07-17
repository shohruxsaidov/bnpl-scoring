import { desc, eq, inArray } from "drizzle-orm"
import { db } from "@db"
import { buyouts, deals, dealItems } from "../../../../deals/schema"
import { merchants, branches, merchantUsers, users, adminUsers } from '@db/schema'
import { getDownloadUrls } from "../../../../../lib/file-storage"
import type { ListBuyoutsInput } from "./list-buyouts.query"

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
  /** Presigned link to the proof of payment; null until the buyout is paid. */
  documentUrl: string | null
  paidAt: string | null
  paidByName: string | null
  items: BuyoutItemDto[]
}

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? String(n) : "—"
}

export async function listBuyouts(
  filters: ListBuyoutsInput = {},
): Promise<BuyoutDto[]> {
  let query = db
    .select({
      buyout: buyouts,
      deal: { dealNumber: deals.dealNumber },
      merchant: { id: merchants.id, name: merchants.name },
      branch: { name: branches.name },
      agent: { fullName: merchantUsers.fullName },
      client: { firstName: users.firstName, lastName: users.lastName, phone: users.phone },
      paidByName: adminUsers.fullName,
    })
    .from(buyouts)
    .leftJoin(deals, eq(buyouts.dealId, deals.id))
    .leftJoin(merchants, eq(buyouts.merchantId, merchants.id))
    .leftJoin(branches, eq(buyouts.branchId, branches.id))
    .leftJoin(merchantUsers, eq(deals.agentId, merchantUsers.id))
    .leftJoin(users, eq(deals.userId, users.id))
    .leftJoin(adminUsers, eq(buyouts.paidBy, adminUsers.id))
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

  // One batch presign for the whole page rather than one per paid row.
  const documentUrls = await getDownloadUrls(
    db,
    rows.map((r) => r.buyout.documentFileId).filter((id): id is number => id != null),
  )

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
    documentUrl: r.buyout.documentFileId
      ? (documentUrls.get(r.buyout.documentFileId) ?? null)
      : null,
    paidAt: r.buyout.paidAt?.toISOString() ?? null,
    paidByName: r.paidByName ?? null,
    items: (itemsByDeal.get(r.buyout.dealId) ?? []).map((i) => {
      const price = parseFloat(i.price)
      return { productName: i.productName, price, qty: i.quantity, amount: price * i.quantity }
    }),
  }))
}
