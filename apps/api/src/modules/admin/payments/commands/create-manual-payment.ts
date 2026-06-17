import { and, asc, eq, sql } from 'drizzle-orm';
import type { Db } from '../../../../db';
import {
  deals,
  dealPaymentSchedules,
  manualPayments,
  dealComments,
} from '../../../deals/db/schema';
import { clients, adminUsers } from '@db/schema';
import type { ManualPayment } from '../queries/list-manual-payments';

export async function createManualPayment(
  db: Db,
  input: {
    dealId: string;
    adminUserId: number;
    amount: number;
    paymentType: string;
    note?: string;
  },
): Promise<ManualPayment> {
  return db.transaction(async (tx) => {
    const amountTiyin = Number(input.amount);

    const unpaid = await tx
      .select()
      .from(dealPaymentSchedules)
      .where(
        and(eq(dealPaymentSchedules.dealId, input.dealId), eq(dealPaymentSchedules.paid, false)),
      )
      .orderBy(asc(dealPaymentSchedules.dueDate));

    const totalRemaining = unpaid.reduce((sum, r) => sum + (r.amount - (r.paidAmount ?? 0)), 0);

    if (amountTiyin > totalRemaining) {
      throw Object.assign(new Error('overpayment'), { statusCode: 400, code: 'OVERPAYMENT' });
    }

    const mpRows = await tx
      .insert(manualPayments)
      .values({
        dealId: input.dealId,
        adminUserId: input.adminUserId,
        amount: amountTiyin,
        paymentType: input.paymentType,
        note: input.note || null,
      })
      .returning();
    const mp = mpRows[0]!;

    let bucket = amountTiyin;
    const now = new Date();

    for (const row of unpaid) {
      if (bucket <= 0) break;
      const rowRemaining = row.amount - (row.paidAmount ?? 0);
      const apply = bucket < rowRemaining ? bucket : rowRemaining;
      const newPaid = (row.paidAmount ?? 0) + apply;
      const fullyPaid = newPaid >= row.amount;

      await tx
        .update(dealPaymentSchedules)
        .set({
          paidAmount: newPaid,
          paid: fullyPaid,
          paidAt: fullyPaid ? now : null,
          manualPaymentId: mp.id,
          paymentProvider: sql`array_append(COALESCE(${dealPaymentSchedules.paymentProvider}, ARRAY[]::text[]), 'manual')`,
        })
        .where(eq(dealPaymentSchedules.id, row.id));

      bucket -= apply;
    }

    const stillUnpaid = await tx
      .select({ id: dealPaymentSchedules.id })
      .from(dealPaymentSchedules)
      .where(
        and(eq(dealPaymentSchedules.dealId, input.dealId), eq(dealPaymentSchedules.paid, false)),
      )
      .limit(1);

    if (stillUnpaid.length === 0) {
      await tx.update(deals).set({ status: 'closed' }).where(eq(deals.id, input.dealId));
    }

    if (input.note) {
      await tx.insert(dealComments).values({
        dealId: input.dealId,
        adminUserId: input.adminUserId,
        text: `Ручной платёж: ${input.note}`,
      });
    }

    const dealRows = await tx
      .select({ dealNumber: deals.dealNumber, clientId: deals.clientId })
      .from(deals)
      .where(eq(deals.id, input.dealId));
    const deal = dealRows[0]!;

    const clientRows = await tx
      .select({ firstName: clients.firstName, lastName: clients.lastName, phone: clients.phone })
      .from(clients)
      .where(eq(clients.id, deal.clientId!));
    const client = clientRows[0]!;

    const adminRows = await tx
      .select({ fullName: adminUsers.fullName })
      .from(adminUsers)
      .where(eq(adminUsers.id, input.adminUserId));
    const admin = adminRows[0];

    return {
      id: mp.id.toString(),
      dealId: mp.dealId,
      dealNumber: `CN-${String(deal.dealNumber).padStart(7, '0')}`,
      clientName: `${client.firstName} ${client.lastName}`,
      clientPhone: client.phone,
      amount: Number(mp.amount),
      paymentType: mp.paymentType,
      note: mp.note,
      createdAt: mp.createdAt.toISOString(),
      adminName: admin?.fullName ?? null,
    };
  });
}
