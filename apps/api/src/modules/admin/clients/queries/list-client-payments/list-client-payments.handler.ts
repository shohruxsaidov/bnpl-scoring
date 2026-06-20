import { and, desc, eq, inArray, sql } from "drizzle-orm"
import { db } from '@db'
import { users, merchants } from '@db/schema'
import { deals, dealPaymentSchedules } from "../../../../deals/schema"

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? String(n) : "—"
}

export async function listUserPayments(id: number) {
  const userRows = await db.select({ pinfl: users.pinfl }).from(users).where(eq(users.id, id)).limit(1)
  if (!userRows[0]) return []
  const pinfl = userRows[0].pinfl

  const allUserRows = await db.select({ id: users.id }).from(users).where(eq(users.pinfl, pinfl))
  const allUserIds = allUserRows.map((r) => r.id)
  if (allUserIds.length === 0) return []

  const dealRows = await db
    .select({
      deal: { id: deals.id, dealNumber: deals.dealNumber, merchantId: deals.merchantId },
      merchant: { name: merchants.name },
    })
    .from(deals)
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .where(and(inArray(deals.userId, allUserIds), sql`${deals.status} != 'draft'`))

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
