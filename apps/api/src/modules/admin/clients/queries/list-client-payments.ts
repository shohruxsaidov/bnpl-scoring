import { and, desc, eq, inArray, sql } from "drizzle-orm"
import type { Db } from "../../../../db"
import { clients, merchants } from '@db/schema'
import { deals, dealPaymentSchedules } from "../../../deals/db/schema"

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? `CN-${String(n).padStart(7, "0")}` : "—"
}

export async function listClientPayments(db: Db, id: number) {
  const clientRows = await db.select({ pinfl: clients.pinfl }).from(clients).where(eq(clients.id, id)).limit(1)
  if (!clientRows[0]) return []
  const pinfl = clientRows[0].pinfl

  const allClientRows = await db.select({ id: clients.id }).from(clients).where(eq(clients.pinfl, pinfl))
  const allClientIds = allClientRows.map((r) => r.id)
  if (allClientIds.length === 0) return []

  const dealRows = await db
    .select({
      deal: { id: deals.id, dealNumber: deals.dealNumber, merchantId: deals.merchantId },
      merchant: { name: merchants.name },
    })
    .from(deals)
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .where(and(inArray(deals.clientId, allClientIds), sql`${deals.status} != 'draft'`))

  if (dealRows.length === 0) return []

  const dealIds = dealRows.map((r) => r.deal.id)
  const dealIndex = new Map(
    dealRows.map((r) => [r.deal.id, { dealNumber: formatDealNumber(r.deal.dealNumber), merchantName: r.merchant?.name ?? "—" }]),
  )

  const scheduleRows = await db
    .select()
    .from(dealPaymentSchedules)
    .where(inArray(dealPaymentSchedules.dealId, dealIds))
    .orderBy(desc(dealPaymentSchedules.dueDate))

  return scheduleRows.map((s) => {
    const dealInfo = dealIndex.get(s.dealId)
    const paidAmount = Number(s.paidAmount ?? 0n)
    const amount = Number(s.amount)
    const status = s.paid ? "paid" : paidAmount > 0 ? "partial" : "unpaid"
    return {
      id: s.id.toString(),
      dealId: s.dealId,
      dealNumber: dealInfo?.dealNumber ?? "—",
      merchantName: dealInfo?.merchantName ?? "—",
      dueDate: s.dueDate,
      amount,
      paidAmount,
      status,
      channel: s.manualPaymentId != null ? ("manual" as const) : ("automated" as const),
    }
  })
}
