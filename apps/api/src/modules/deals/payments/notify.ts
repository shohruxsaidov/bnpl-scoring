import { notify } from '../../client/notifications/service';

export interface PaymentReceivedPush {
  userId: number;
  paymentId: number;
  /** Som. */
  amount: number;
  dealClosed: boolean;
}

/**
 * Tell the client their money landed. Rail-agnostic on purpose — Payme and Plum
 * both book through applyPayment(), so they both announce it the same way and a
 * client never has to learn that two payments of theirs took different routes.
 *
 * Called AFTER the ledger transaction commits, never inside it. notify() is
 * contractually non-throwing and writes an inbox row before enqueueing the FCM
 * push, so a dead push provider costs a notification, not a payment. Doing this
 * inline would put an external service on a payment response path, and for Payme
 * a timeout on a payment we already booked means Payme retries a Perform we have
 * to answer idempotently — survivable, but not worth inviting.
 *
 * dedupeKey is the ledger row id: no rail ever re-books a payment, so none of
 * them can re-push either.
 */
export async function enqueuePaymentReceivedPush(input: PaymentReceivedPush): Promise<void> {
  await notify({
    userId: input.userId,
    type: 'payment_received',
    data: { amount: input.amount, dealClosed: input.dealClosed },
    dedupeKey: `deal_payment:${input.paymentId}`,
  });
}
