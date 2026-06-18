import { eq } from "drizzle-orm"
import { db } from "@db"
import { deals, dealItems, dealPaymentSchedules } from "../../../../deals/schema"
import { users, tariffs, merchantUsers, merchants } from '@db/schema'

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? `CN-${String(n).padStart(7, "0")}` : "—"
}

export async function getAdminDeal(id: string) {
  const rows = await db
    .select({
      deal: deals,
      client: users,
      tariff: tariffs,
      agent: merchantUsers,
      merchant: merchants,
    })
    .from(deals)
    .leftJoin(users, eq(deals.userId, users.id))
    .leftJoin(tariffs, eq(deals.tariffId, tariffs.id))
    .leftJoin(merchantUsers, eq(deals.agentId, merchantUsers.id))
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .where(eq(deals.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const { deal, client, tariff, agent, merchant } = row

  const [itemRows, scheduleRows] = await Promise.all([
    db.select().from(dealItems).where(eq(dealItems.dealId, id)).orderBy(dealItems.id),
    db
      .select()
      .from(dealPaymentSchedules)
      .where(eq(dealPaymentSchedules.dealId, id))
      .orderBy(dealPaymentSchedules.index),
  ])

  return {
    id: deal.id,
    dealNumber: formatDealNumber(deal.dealNumber),
    merchantId: deal.merchantId.toString(),
    merchantName: merchant?.name ?? "—",
    clientName: client ? `${client.firstName} ${client.lastName}` : "—",
    clientPinfl: client?.pinfl ?? "—",
    clientPhone: client?.phone ?? "—",
    status: deal.status,
    amount: deal.amount != null ? Number(deal.amount) : 0,
    totalPayable: deal.totalPayable != null ? Number(deal.totalPayable) : 0,
    prepaymentAmount: deal.prepaymentAmount != null ? Number(deal.prepaymentAmount) : 0,
    termMonths: deal.termMonths ?? tariff?.termMonths ?? 0,
    paymentDay: deal.paymentDay ?? null,
    scoreSum: deal.scoreSum != null ? Number(deal.scoreSum) : null,
    scoringDecision: deal.scoringDecision ?? null,
    agentId: deal.agentId.toString(),
    agentName: agent?.fullName ?? "—",
    tariffName: tariff?.name ?? "—",
    createdAt: deal.createdAt.toISOString(),
    lang: deal.lang ?? "ru",
    basket: itemRows.map((i) => ({
      productName: i.productName,
      price: i.price,
      mxikCode: i.mxikCode ?? null,
      quantity: i.quantity,
    })),
    schedule: scheduleRows.map((s) => ({
      index: s.index,
      dueDate: s.dueDate,
      amount: Number(s.amount),
      paidAmount: Number(s.paidAmount ?? 0n),
      paid: s.paid,
      paidAt: s.paidAt?.toISOString() ?? null,
    })),
    factors: [],
  }
}
