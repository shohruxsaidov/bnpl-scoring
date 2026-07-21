import { desc, eq } from "drizzle-orm"
import { db } from "@db"
import { deals, dealPayments, type DealPaymentSource } from "../../../../deals/schema"
import { users, adminUsers } from '@db/schema'

// Despite the file name this lists ALL money-in events, not just the ones an
// admin typed in — a Payme payment settles the same instalments and collections
// staff need it in the same place. `source` is what tells them apart; a Payme
// row has no adminName because no human booked it.
export interface ManualPayment {
  id: string
  dealId: string
  dealNumber: string
  clientName: string
  clientPhone: string
  amount: number
  source: DealPaymentSource
  paymentType: string
  note: string | null
  createdAt: string
  adminName: string | null
}

export async function listManualPayments(source?: DealPaymentSource): Promise<ManualPayment[]> {
  const rows = await db
    .select({
      id: dealPayments.id,
      dealId: dealPayments.dealId,
      dealNumber: deals.dealNumber,
      amount: dealPayments.amount,
      source: dealPayments.source,
      paymentType: dealPayments.paymentType,
      note: dealPayments.note,
      createdAt: dealPayments.createdAt,
      firstName: users.firstName,
      lastName: users.lastName,
      clientPhone: users.phone,
      adminName: adminUsers.fullName,
    })
    .from(dealPayments)
    .innerJoin(deals, eq(dealPayments.dealId, deals.id))
    .innerJoin(users, eq(users.id, deals.userId))
    .leftJoin(adminUsers, eq(dealPayments.adminUserId, adminUsers.id))
    .where(source ? eq(dealPayments.source, source) : undefined)
    .orderBy(desc(dealPayments.createdAt))

  return rows.map((r) => ({
    id: r.id.toString(),
    dealId: r.dealId,
    dealNumber: String(r.dealNumber),
    clientName: `${r.firstName} ${r.lastName}`,
    clientPhone: r.clientPhone,
    amount: Number(r.amount),
    source: r.source,
    paymentType: r.paymentType,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    adminName: r.adminName ?? null,
  }))
}
