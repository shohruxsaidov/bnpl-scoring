import { desc, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { deals, dealPaymentSchedules, manualPayments } from "../../../deals/db/schema"
import { clients, adminUsers } from "../../../id/db/schema"

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

export async function listManualPayments(db: Db): Promise<ManualPayment[]> {
  const rows = await db
    .select({
      id: manualPayments.id,
      dealId: manualPayments.dealId,
      dealNumber: deals.dealNumber,
      amount: manualPayments.amount,
      paymentType: manualPayments.paymentType,
      note: manualPayments.note,
      createdAt: manualPayments.createdAt,
      firstName: clients.firstName,
      lastName: clients.lastName,
      clientPhone: clients.phone,
      adminName: adminUsers.fullName,
    })
    .from(manualPayments)
    .innerJoin(deals, eq(manualPayments.dealId, deals.id))
    .innerJoin(clients, eq(clients.id, deals.clientId))
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
