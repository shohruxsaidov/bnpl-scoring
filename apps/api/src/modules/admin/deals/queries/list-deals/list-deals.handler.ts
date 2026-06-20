import { desc, eq, inArray } from "drizzle-orm"
import { db } from "@db"
import { deals, dealItems, dealPaymentSchedules } from "../../../../deals/schema"
import { users, tariffs, merchantUsers } from '@db/schema'
import type { ListAdminDealsQuery } from "./list-deals.query"

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? String(n) : "—"
}

export async function listAdminDeals(filters: ListAdminDealsQuery = {}) {
  let query = db
    .select({
      deal: deals,
      client: users,
      tariff: tariffs,
      agent: merchantUsers,
    })
    .from(deals)
    .leftJoin(users, eq(deals.userId, users.id))
    .leftJoin(tariffs, eq(deals.tariffId, tariffs.id))
    .leftJoin(merchantUsers, eq(deals.agentId, merchantUsers.id))
    .orderBy(desc(deals.createdAt))
    .$dynamic()

  if (filters.status) {
    query = query.where(eq(deals.status, filters.status))
  }
  if (filters.merchantId) {
    query = query.where(eq(deals.merchantId, filters.merchantId))
  }

  const rows = await query
  const nonDraft = rows.filter((r) => r.deal.status !== "draft")
  if (nonDraft.length === 0) return []

  const ids = nonDraft.map((r) => r.deal.id)

  const [itemRows, scheduleRows] = await Promise.all([
    db.select().from(dealItems).where(inArray(dealItems.dealId, ids)),
    db
      .select()
      .from(dealPaymentSchedules)
      .where(inArray(dealPaymentSchedules.dealId, ids))
      .orderBy(dealPaymentSchedules.dealId, dealPaymentSchedules.index),
  ])

  const basketByDeal = new Map<string, typeof itemRows>()
  for (const item of itemRows) {
    const arr = basketByDeal.get(item.dealId) ?? []
    arr.push(item)
    basketByDeal.set(item.dealId, arr)
  }

  const scheduleByDeal = new Map<string, typeof scheduleRows>()
  for (const row of scheduleRows) {
    const arr = scheduleByDeal.get(row.dealId) ?? []
    arr.push(row)
    scheduleByDeal.set(row.dealId, arr)
  }

  return nonDraft.map(({ deal, client, tariff, agent }) => {
    const basket = (basketByDeal.get(deal.id) ?? []).map((i) => ({
      name: i.productName,
      quantity: i.quantity,
      price: Math.round(parseFloat(i.price) * 100),
    }))
    const schedule = (scheduleByDeal.get(deal.id) ?? []).map((s) => ({
      index: s.index,
      date: new Date(s.dueDate).toISOString(),
      amount: Number(s.amount),
      paidAmount: Number(s.paidAmount ?? 0n),
      paid: s.paid,
    }))
    return {
      id: deal.id,
      dealNumber: formatDealNumber(deal.dealNumber),
      tenantId: deal.merchantId.toString(),
      clientName: client ? `${client.firstName} ${client.lastName}` : "—",
      clientPinfl: client?.pinfl ?? "—",
      clientPhone: client?.phone ?? "—",
      status: deal.status,
      amount: deal.amount != null ? Number(deal.amount) : 0,
      totalPayable: deal.totalPayable != null ? Number(deal.totalPayable) : 0,
      score: deal.scoreSum != null ? Number(deal.scoreSum) : 0,
      decision: deal.scoringDecision ?? "manual_review",
      agentId: deal.agentId.toString(),
      agentName: agent?.fullName ?? "—",
      tariffName: tariff?.name ?? "—",
      termMonths: deal.termMonths ?? tariff?.termMonths ?? 0,
      createdAt: deal.createdAt.toISOString(),
      basket,
      schedule,
      factors: [],
    }
  })
}
