import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealComments } from '../../../../deals/schema';
import { applyPayment, lockDeal, todayIsoDate } from '../../../../deals/payments/apply-payment';
import { users, adminUsers } from '@db/schema';
import {
  InvalidPaymentDateError,
  type CreatedManualPayment,
  type CreateManualPaymentInput,
} from './create-manual-payment.command';

export async function createManualPayment(
  input: CreateManualPaymentInput,
): Promise<CreatedManualPayment> {
  return db.transaction(async (tx) => {
    // Serialize against the other rail (Payme) settling the same instalments.
    const deal = await lockDeal(tx, input.dealId);
    if (!deal) throw Object.assign(new Error('deal not found'), { statusCode: 404 });

    // The value date must fall inside the window in which this deal could have
    // been paid. Both bounds need the deal row, which is why this cannot live in
    // the route's TypeBox schema.
    const today = todayIsoDate();
    const dealOpened = deal.createdAt.toISOString().slice(0, 10);
    if (input.paymentDate > today || input.paymentDate < dealOpened) {
      throw new InvalidPaymentDateError(input.paymentDate, dealOpened, today);
    }

    // Throws OverpaymentError; the route maps its `code` to 400 OVERPAYMENT.
    const { paymentId, createdAt } = await applyPayment(tx, {
      dealId: input.dealId,
      amount: Number(input.amount),
      source: 'manual',
      paymentType: input.paymentType,
      adminUserId: input.adminUserId,
      note: input.note,
      paymentDate: input.paymentDate,
      provider: 'manual',
    });

    // A backdated payment always leaves a trace, note or not: it rewrites whether
    // an instalment was settled on time, and `payment_date` vs `created_at` is not
    // something anyone diffs by hand during a dispute.
    const backdated = input.paymentDate !== today;
    if (backdated || input.note) {
      const parts = [`Ручной платёж`];
      if (backdated) parts.push(`дата платежа ${input.paymentDate} (внесён ${today})`);
      if (input.note) parts.push(input.note);
      await tx.insert(dealComments).values({
        dealId: input.dealId,
        adminUserId: input.adminUserId,
        text: parts.join(': '),
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
      paymentDate: input.paymentDate,
      createdAt: createdAt.toISOString(),
      adminName: admin?.fullName ?? null,
    };
  });
}
