import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealComments } from '../../../../deals/schema';
import { applyPayment, lockDeal } from '../../../../deals/payments/apply-payment';
import { users, adminUsers } from '@db/schema';
import type { ManualPayment } from '../../queries/list-manual-payments/list-manual-payments.handler';
import type { CreateManualPaymentInput } from './create-manual-payment.command';

export async function createManualPayment(input: CreateManualPaymentInput): Promise<ManualPayment> {
  return db.transaction(async (tx) => {
    // Serialize against the other rail (Payme) settling the same instalments.
    const deal = await lockDeal(tx, input.dealId);
    if (!deal) throw Object.assign(new Error('deal not found'), { statusCode: 404 });

    // Throws OverpaymentError; the route maps its `code` to 400 OVERPAYMENT.
    const { paymentId, createdAt } = await applyPayment(tx, {
      dealId: input.dealId,
      amount: Number(input.amount),
      source: 'manual',
      paymentType: input.paymentType,
      adminUserId: input.adminUserId,
      note: input.note,
      provider: 'manual',
    });

    if (input.note) {
      await tx.insert(dealComments).values({
        dealId: input.dealId,
        adminUserId: input.adminUserId,
        text: `Ручной платёж: ${input.note}`,
      });
    }

    const clientRows = await tx
      .select({ firstName: users.firstName, lastName: users.lastName, phone: users.phone })
      .from(users)
      .where(eq(users.id, deal.userId!));
    const client = clientRows[0]!;

    const adminRows = await tx
      .select({ fullName: adminUsers.fullName })
      .from(adminUsers)
      .where(eq(adminUsers.id, input.adminUserId));
    const admin = adminRows[0];

    return {
      id: paymentId.toString(),
      dealId: input.dealId,
      dealNumber: String(deal.dealNumber),
      clientName: `${client.firstName} ${client.lastName}`,
      clientPhone: client.phone,
      amount: Number(input.amount),
      source: 'manual' as const,
      paymentType: input.paymentType,
      note: input.note ?? null,
      createdAt: createdAt.toISOString(),
      adminName: admin?.fullName ?? null,
    };
  });
}
