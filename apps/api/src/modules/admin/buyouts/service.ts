import { desc, eq } from 'drizzle-orm'
import type { Db } from '../../../db'
import { buyouts } from '../../deals/db/schema'
import { merchants, branches, merchantUsers, clients } from '../../id/db/schema'
import { deals } from '../../deals/db/schema'

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
}

function formatDealNumber(n: bigint | null | undefined): string {
  return n != null ? `CN-${String(n).padStart(7, '0')}` : '—'
}

export async function listBuyouts(
  db: Db,
  filters: { merchantId?: bigint; status?: string } = {},
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

  return rows.map((r) => ({
    id: String(r.buyout.id),
    dealId: r.buyout.dealId,
    dealNumber: formatDealNumber(r.deal?.dealNumber ?? null),
    merchantId: String(r.buyout.merchantId),
    merchantName: r.merchant?.name ?? '—',
    branchName: r.branch?.name ?? '—',
    agentName: r.agent?.fullName ?? '—',
    clientName: r.client ? `${r.client.lastName} ${r.client.firstName}` : '—',
    clientPhone: r.client?.phone ?? '—',
    amount: Number(r.buyout.amount),
    status: r.buyout.status,
    createdAt: r.buyout.createdAt.toISOString(),
  }))
}

export async function markBuyoutPaid(db: Db, id: bigint): Promise<BuyoutDto | null> {
  const [updated] = await db
    .update(buyouts)
    .set({ status: 'paid' })
    .where(eq(buyouts.id, id))
    .returning()

  if (!updated) return null

  const rows = await db
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
    .where(eq(buyouts.id, id))
    .limit(1)

  const r = rows[0]
  if (!r) return null

  return {
    id: String(r.buyout.id),
    dealId: r.buyout.dealId,
    dealNumber: formatDealNumber(r.deal?.dealNumber ?? null),
    merchantId: String(r.buyout.merchantId),
    merchantName: r.merchant?.name ?? '—',
    branchName: r.branch?.name ?? '—',
    agentName: r.agent?.fullName ?? '—',
    clientName: r.client ? `${r.client.lastName} ${r.client.firstName}` : '—',
    clientPhone: r.client?.phone ?? '—',
    amount: Number(r.buyout.amount),
    status: r.buyout.status,
    createdAt: r.buyout.createdAt.toISOString(),
  }
}
