import { and, eq, sql } from "drizzle-orm"
import { db } from "@db"
import { deals, dealPaymentSchedules } from "../../../../deals/schema"
import { clients } from '@db/schema'

export interface DealSearchResult {
  id: string
  dealNumber: string
  clientName: string
  clientPhone: string
  remainingAmount: number
}

export async function searchDealsForManualPayment(q: string): Promise<DealSearchResult[]> {
  const stripped = q.replace(/^CN-0*/i, "").trim()
  if (!stripped) return []

  const dealRows = await db
    .select({
      id: deals.id,
      dealNumber: deals.dealNumber,
      firstName: clients.firstName,
      lastName: clients.lastName,
      phone: clients.phone,
    })
    .from(deals)
    .innerJoin(clients, eq(clients.id, deals.clientId))
    .where(
      and(
        sql`deals.status NOT IN ('draft', 'declined')`,
        sql`deals.deal_number::text LIKE ${stripped + "%"}`,
      ),
    )
    .limit(10)

  if (dealRows.length === 0) return []

  return Promise.all(
    dealRows.map(async (d) => {
      const scheduleRows = await db
        .select({ amount: dealPaymentSchedules.amount, paidAmount: dealPaymentSchedules.paidAmount })
        .from(dealPaymentSchedules)
        .where(and(eq(dealPaymentSchedules.dealId, d.id), eq(dealPaymentSchedules.paid, false)))

      const remaining = scheduleRows.reduce(
        (sum, r) => sum + Number(r.amount) - Number(r.paidAmount ?? 0n),
        0,
      )

      return {
        id: d.id,
        dealNumber: `CN-${String(d.dealNumber).padStart(7, "0")}`,
        clientName: `${d.firstName} ${d.lastName}`,
        clientPhone: d.phone,
        remainingAmount: remaining,
      }
    }),
  )
}
