import { and, desc, eq, gt, or } from "drizzle-orm"
import type { Db } from "../../../../db"
import { deals, dealPaymentSchedules } from "../../../deals/db/schema"
import { clients, merchants } from '@db/schema'

export interface Payment {
  id: string
  merchantId: string
  merchantName: string
  clientName: string
  clientPhone: string
  contractId: string
  dealNumber: string
  amount: number
  paidAmount: number
  type: "cash" | "card" | "transfer"
  status: "confirmed" | "pending" | "partial" | "cancelled"
  date: string
  paymentProvider: string[] | null
}

export async function listPayments(
  db: Db,
  filters: { merchantId?: number } = {},
): Promise<Payment[]> {
  let query = db
    .select({
      id: dealPaymentSchedules.id,
      contractId: deals.id,
      dealNumber: deals.dealNumber,
      merchantId: deals.merchantId,
      merchantName: merchants.name,
      firstName: clients.firstName,
      lastName: clients.lastName,
      clientPhone: clients.phone,
      amount: dealPaymentSchedules.amount,
      paidAmount: dealPaymentSchedules.paidAmount,
      paid: dealPaymentSchedules.paid,
      paidAt: dealPaymentSchedules.paidAt,
      dueDate: dealPaymentSchedules.dueDate,
      paymentProvider: dealPaymentSchedules.paymentProvider,
    })
    .from(dealPaymentSchedules)
    .innerJoin(deals, eq(dealPaymentSchedules.dealId, deals.id))
    .innerJoin(clients, eq(clients.id, deals.clientId))
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .orderBy(desc(dealPaymentSchedules.dueDate))
    .$dynamic()

  const notPending = or(eq(dealPaymentSchedules.paid, true), gt(dealPaymentSchedules.paidAmount, 0))!

  if (filters.merchantId) {
    query = query.where(and(notPending, eq(deals.merchantId, filters.merchantId)))
  } else {
    query = query.where(notPending)
  }

  const rows = await query

  return rows.map((r) => ({
    id: r.id.toString(),
    merchantId: r.merchantId.toString(),
    merchantName: r.merchantName ?? "—",
    clientName: `${r.firstName} ${r.lastName}`,
    clientPhone: r.clientPhone,
    contractId: r.contractId,
    dealNumber: `CN-${String(r.dealNumber ?? 0).padStart(7, "0")}`,
    amount: Number(r.amount),
    paidAmount: Number(r.paidAmount ?? 0),
    type: "transfer" as const,
    status: r.paid
      ? ("confirmed" as const)
      : Number(r.paidAmount ?? 0) > 0
        ? ("partial" as const)
        : ("pending" as const),
    date: r.paidAt ? r.paidAt.toISOString() : new Date(`${r.dueDate}T00:00:00.000Z`).toISOString(),
    paymentProvider: r.paymentProvider ?? null,
  }))
}
