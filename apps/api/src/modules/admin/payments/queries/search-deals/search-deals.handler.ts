import { and, eq, sql } from "drizzle-orm"
import { db } from "@db"
import { deals, dealPaymentSchedules } from "../../../../deals/schema"
import { users } from '@db/schema'

export interface DealSearchResult {
  id: string
  dealNumber: string
  clientName: string
  clientPhone: string
  remainingAmount: number
}

export async function searchDealsForManualPayment(q: string): Promise<DealSearchResult[]> {
  const stripped = q.trim()
  if (!stripped) return []

  const dealRows = await db
    .select({
      id: deals.id,
      dealNumber: deals.dealNumber,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
    })
    .from(deals)
    .innerJoin(users, eq(users.id, deals.userId))
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
        dealNumber: String(d.dealNumber),
        clientName: `${d.firstName} ${d.lastName}`,
        clientPhone: d.phone,
        remainingAmount: remaining,
      }
    }),
  )
}
