import { desc, eq } from "drizzle-orm"
import { db } from "@db"
import { deals, dealPaymentSchedules, manualPayments } from "../../../../deals/schema"
import { users, adminUsers } from '@db/schema'

export interface ManualPayment {
  id: string
  dealId: string
  dealNumber: string
  clientName: string
  clientPhone: string
  amount: number
  paymentType: string
  note: string | null
  createdAt: string
  adminName: string | null
}

export async function listManualPayments(): Promise<ManualPayment[]> {
  const rows = await db
    .select({
      id: manualPayments.id,
      dealId: manualPayments.dealId,
      dealNumber: deals.dealNumber,
      amount: manualPayments.amount,
      paymentType: manualPayments.paymentType,
      note: manualPayments.note,
      createdAt: manualPayments.createdAt,
      firstName: users.firstName,
      lastName: users.lastName,
      clientPhone: users.phone,
      adminName: adminUsers.fullName,
    })
    .from(manualPayments)
    .innerJoin(deals, eq(manualPayments.dealId, deals.id))
    .innerJoin(users, eq(users.id, deals.userId))
    .leftJoin(adminUsers, eq(manualPayments.adminUserId, adminUsers.id))
    .orderBy(desc(manualPayments.createdAt))

  return rows.map((r) => ({
    id: r.id.toString(),
    dealId: r.dealId,
    dealNumber: `CN-${String(r.dealNumber).padStart(7, "0")}`,
    clientName: `${r.firstName} ${r.lastName}`,
    clientPhone: r.clientPhone,
    amount: Number(r.amount),
    paymentType: r.paymentType,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    adminName: r.adminName ?? null,
  }))
}
