import { notify } from '../../client/notifications/service';

export interface PaymentReceivedPush {
  userId: number;
  paymentId: number;
  /** Som. */
  amount: number;
  dealClosed: boolean;
}

/**
 * Tell the client their money landed.
 *
 * Called AFTER the ledger transaction commits, never inside it. notify() is
 * contractually non-throwing and writes an inbox row before enqueueing the FCM
 * push, so a dead push provider costs a notification, not a payment. Doing this
 * inline would put an external service on Payme's response path, and a Payme
 * timeout on a payment we already booked means Payme retries a Perform we have
 * to answer idempotently — survivable, but not worth inviting.
 *
 * dedupeKey is the ledger row id: a replayed Perform never re-books a payment,
 * so it can never re-push either.
 */
export async function enqueuePaymentReceivedPush(input: PaymentReceivedPush): Promise<void> {
  await notify({
    userId: input.userId,
    type: 'payment_received',
    data: { amount: input.amount, dealClosed: input.dealClosed },
    dedupeKey: `deal_payment:${input.paymentId}`,
  });
}
