import { eq } from "drizzle-orm"
import { db } from "@db"
import { deals, dealItems, dealPaymentSchedules, dealReceipts } from "../../../../deals/schema"
import { users, tariffs, merchantUsers, merchants, dealSessions } from '@db/schema'

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? String(n) : "—"
}

export async function getAdminDeal(id: string) {
  const rows = await db
    .select({
      deal: deals,
      client: users,
      tariff: tariffs,
      agent: merchantUsers,
      merchant: merchants,
      session: dealSessions,
    })
    .from(deals)
    .leftJoin(users, eq(deals.userId, users.id))
    .leftJoin(tariffs, eq(deals.tariffId, tariffs.id))
    .leftJoin(merchantUsers, eq(deals.agentId, merchantUsers.id))
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .leftJoin(dealSessions, eq(deals.dealSessionId, dealSessions.id))
    .where(eq(deals.id, id))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  const { deal, client, tariff, agent, merchant, session } = row

  const [itemRows, scheduleRows, receiptRows] = await Promise.all([
    db.select().from(dealItems).where(eq(dealItems.dealId, id)).orderBy(dealItems.id),
    db
      .select()
      .from(dealPaymentSchedules)
      .where(eq(dealPaymentSchedules.dealId, id))
      .orderBy(dealPaymentSchedules.index),
    db.select().from(dealReceipts).where(eq(dealReceipts.dealId, id)).limit(1),
  ])

  const receiptRow = receiptRows[0]

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
    // null when no receipt has been issued. A 'pending' receipt carries no
    // payload — it means the last attempt died mid-call and EPOS may hold a
    // receipt we never recorded.
    receipt: receiptRow
      ? {
          status: receiptRow.status,
          receiptSeq: receiptRow.payload?.receiptSeq ?? null,
          fiscalSign: receiptRow.payload?.fiscalSign ?? null,
          datetime: receiptRow.payload?.datetime ?? null,
          qrCodeUrl: receiptRow.payload?.qrCodeUrl ?? null,
          createdAt: receiptRow.createdAt.toISOString(),
        }
      : null,
    factors: [],
    bailsmen: ((session?.stepData as Record<string, unknown> | null)?.bailsmen as Array<{ relation: string; phone: string }> | undefined) ?? [],
  }
}
