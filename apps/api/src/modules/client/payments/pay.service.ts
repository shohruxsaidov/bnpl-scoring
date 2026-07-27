import { randomUUID } from 'node:crypto';
import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import { db } from '@db';
import { deals, userCards } from '@db/schema';
import {
  plumPaymentSessions,
  type PlumPaymentSessionStatus,
} from '@db/plum-payment-sessions';
import { isUniqueViolation } from '@lib/pg-errors';
import {
  applyPayment,
  getRemainingDebt,
  lockDeal,
  MIN_PAYMENT_SOM,
  OverpaymentError,
  PAYABLE_DEAL_STATUSES,
} from '../../deals/payments/apply-payment';
import { enqueuePaymentReceivedPush } from '../../deals/payments/notify';
import { makingPaymentHandler } from '../../integrations/plumgate/commands/making-payment/making-payment.handler';
import { confirmPaymentHandler } from '../../integrations/plumgate/commands/making-payment/confirm-payment.handler';
import { isRetryablePlumError, plumErrorCode } from '../../integrations/plumgate/errors';

// ---------------------------------------------------------------------------
// Client card payments through Plumgate — the two halves of one OTP handshake.
//
// The shape of this file is dictated by a single fact: Plum's confirmPayment is
// IRREVERSIBLE and there is no refund path anywhere in this system. So every
// check that can refuse a payment runs BEFORE that call, and the only work left
// after it is booking money we have already taken. See plum_payment_sessions for
// what survives between the two halves and why it has to.
// ---------------------------------------------------------------------------

/**
 * Errors whose `message` is an i18n key and whose `statusCode` the global error
 * handler (plugins/i18n.ts) turns into the response status. Same trick the deal
 * receipt command uses — the route stays a thin shell.
 */
function coded(code: string, statusCode: number): Error & { code: string; statusCode: number } {
  return Object.assign(new Error(code), { code, statusCode });
}

/** Som are 2dp; a client can send anything and float compares are unforgiving. */
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * How long a session may sit unconfirmed before the sweeper frees the deal.
 *
 * Plum expires its own OTP (error -2), so this is not the authority on whether a
 * code still works — it exists so a client who never returns to the app does not
 * pin their own deal forever, which is exactly the hole the Payme sweeper was
 * written to close.
 */
export const PLUM_SESSION_TTL_MS = 15 * 60 * 1000;

export interface InitiatePlumPaymentInput {
  userId: number;
  dealId: string;
  /** user_cards.plum_id — the id GET /client/cards hands the app. */
  cardId: number;
  /** In som. */
  amount: number;
}

export interface InitiatePlumPaymentResult {
  sessionId: number;
  otpSentPhone: string;
  /** In som — echoed so the OTP screen can restate what is about to be charged. */
  amount: number;
}

/**
 * Step one: validate everything, claim the deal's live-payment slot, then ask
 * Plum to send an OTP.
 *
 * The row is inserted BEFORE the vendor call, not after. Inserting afterwards
 * would leave a window where two devices both pass validation and both send an
 * OTP, and the unique index — the only thing that arbitrates that race, since a
 * SELECT cannot see another transaction's uncommitted insert — would never get
 * the chance to fire.
 */
export async function initiatePlumPayment(
  input: InitiatePlumPaymentInput,
): Promise<InitiatePlumPaymentResult> {
  const amount = round2(input.amount);
  const extraId = randomUUID();

  // Everything that can refuse the payment happens here, under the deal lock, so
  // the debt this amount is checked against cannot move while we check it.
  const session = await db
    .transaction(async (tx) => {
      const deal = await lockDeal(tx, input.dealId);
      // Ownership is checked on the locked row, not before it: a 404 for someone
      // else's deal must be indistinguishable from a 404 for one that does not
      // exist, or the endpoint enumerates deal ids.
      if (!deal || deal.userId !== input.userId) throw coded('deal_not_found', 404);
      if (!PAYABLE_DEAL_STATUSES.has(deal.status)) throw coded('deal_not_payable', 409);

      // The card must be one of the caller's own. user_cards is the local
      // ownership ledger; a card id the client made up, or one belonging to
      // another user, dies here rather than at Plum.
      const [card] = await tx
        .select({ plumId: userCards.plumId })
        .from(userCards)
        .where(and(eq(userCards.userId, input.userId), eq(userCards.plumId, input.cardId)))
        .limit(1);
      if (!card) throw coded('card_not_found', 404);

      if (!(amount >= MIN_PAYMENT_SOM)) {
        throw Object.assign(coded('amount_too_small', 400), { args: { min: MIN_PAYMENT_SOM } });
      }

      // The ceiling. applyPayment would refuse an overshoot anyway, but by then
      // the card has been debited and there is no way to give the money back —
      // so the check that matters is this one, before any OTP exists.
      const remaining = await getRemainingDebt(tx, input.dealId);
      if (amount > remaining) {
        throw Object.assign(coded('amount_exceeds_debt', 409), { args: { remaining } });
      }

      const [row] = await tx
        .insert(plumPaymentSessions)
        .values({
          userId: input.userId,
          dealId: input.dealId,
          cardId: card.plumId,
          amountSom: amount,
          extraId,
        })
        .returning();
      return row!;
    })
    .catch((err) => {
      // Lost the race for the deal's one live payment, or the client simply has
      // an OTP outstanding already. Either way the answer is the same: resume
      // the session you have rather than burn another SMS.
      if (isUniqueViolation(err, 'plum_payment_sessions_deal_live_uq')) {
        throw coded('payment_already_pending', 409);
      }
      throw err;
    });

  // Only now does anything leave the building.
  let plum: { session: number; otpSentPhone: string };
  try {
    plum = await makingPaymentHandler({
      userId: String(input.userId),
      cardId: session.cardId,
      amount: session.amountSom,
      extraId: session.extraId,
      // Carried so a Plum-side statement can be reconciled against our ledger
      // without joining through our database first.
      transactionData: JSON.stringify({ dealId: session.dealId, sessionId: session.id }),
    });
  } catch (err) {
    // No OTP was sent, so nothing is outstanding — release the deal immediately
    // rather than making the client wait out the sweeper.
    await markSessionFailed(session.id, plumErrorCode(err));
    throw err;
  }

  await db
    .update(plumPaymentSessions)
    .set({ plumSession: plum.session, updatedAt: new Date() })
    .where(eq(plumPaymentSessions.id, session.id));

  return {
    sessionId: plum.session,
    otpSentPhone: plum.otpSentPhone,
    amount: session.amountSom,
  };
}

export interface ConfirmPlumPaymentInput {
  userId: number;
  /** Plum's session handle, as returned by step one. */
  sessionId: number;
  otp: string;
}

export interface ConfirmPlumPaymentResult {
  /** Null only when the debit succeeded but booking did not — see `booked`. */
  paymentId: number | null;
  /** In som. */
  amount: number;
  /** Debt left on the deal after this payment. Null when nothing was booked. */
  remainingDebt: number | null;
  /** True when this payment settled the last instalment and closed the credit. */
  dealClosed: boolean;
  /**
   * False means Plum took the money and we could not allocate it. The client is
   * told their payment was accepted — which is true — and a human resolves it.
   */
  booked: boolean;
}

/**
 * Step two: re-validate, hand the OTP to Plum, then book what Plum took.
 *
 * The deal lock is deliberately NOT held across the vendor call. Holding it
 * would make the race impossible, at the price of pinning a row — and a pooled
 * connection — for the length of a network round-trip on every payment, blocking
 * admin bookings on that deal for as long as Plum takes to answer. The residual
 * millisecond race is handled by not losing the money (see `debited_unbooked`).
 */
export async function confirmPlumPayment(
  input: ConfirmPlumPaymentInput,
): Promise<ConfirmPlumPaymentResult> {
  // ── Pre-flight: everything that can still refuse, before the point of no return
  const session = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(plumPaymentSessions)
      .where(
        and(
          eq(plumPaymentSessions.plumSession, input.sessionId),
          eq(plumPaymentSessions.userId, input.userId),
        ),
      )
      .limit(1);

    // Scoped to the caller, so another client's session id is simply not found.
    if (!row) throw coded('payment_session_not_found', 404);
    if (row.status !== 'pending') throw coded('payment_session_not_pending', 409);

    const deal = await lockDeal(tx, row.dealId);
    if (!deal) throw coded('deal_not_found', 404);
    if (!PAYABLE_DEAL_STATUSES.has(deal.status)) {
      await failWithin(tx, row.id, 'deal_not_payable');
      throw coded('deal_not_payable', 409);
    }

    // Re-read the debt from scratch. Between the OTP being sent and the client
    // reading it, an admin can record an MIB transfer or a Payme payment can
    // land, and the amount this session was quoted may no longer fit. Refusing
    // HERE costs the client a restart; refusing after the debit would cost them
    // money we cannot return.
    const remaining = await getRemainingDebt(tx, row.dealId);
    if (row.amountSom > remaining) {
      await failWithin(tx, row.id, 'amount_exceeds_debt');
      throw Object.assign(coded('amount_exceeds_debt', 409), { args: { remaining } });
    }

    // Claiming the row for this confirm attempt. Also stops two taps on the
    // Confirm button from both reaching Plum.
    const claimed = await tx
      .update(plumPaymentSessions)
      .set({ status: 'confirming', updatedAt: new Date() })
      .where(and(eq(plumPaymentSessions.id, row.id), eq(plumPaymentSessions.status, 'pending')))
      .returning();
    if (!claimed.length) throw coded('payment_session_not_pending', 409);

    return row;
  });

  // ── The point of no return ────────────────────────────────────────────────
  let transactionId: string;
  try {
    const result = await confirmPaymentHandler({ sessionId: input.sessionId, otp: input.otp });
    transactionId = result.transactionId;
  } catch (err) {
    // A mistyped code leaves the attempt alive on the SAME session — the client
    // retypes. Anything else ends it and frees the deal, because a session stuck
    // in 'confirming' would hold the live slot with no way to ever release it.
    const code = plumErrorCode(err);
    if (isRetryablePlumError(err)) {
      await db
        .update(plumPaymentSessions)
        .set({ status: 'pending', failureCode: code, updatedAt: new Date() })
        .where(eq(plumPaymentSessions.id, session.id));
    } else {
      await markSessionFailed(session.id, code);
    }
    throw err;
  }

  // The money is gone from the card. This write happens BEFORE any attempt to
  // book it: it is the only evidence the debit occurred, and if the process dies
  // on the next line a human can still find the transaction and finish the job.
  await db
    .update(plumPaymentSessions)
    .set({ plumTransactionId: transactionId, updatedAt: new Date() })
    .where(eq(plumPaymentSessions.id, session.id));

  // ── Booking ───────────────────────────────────────────────────────────────
  try {
    const booked = await db.transaction(async (tx) => {
      await lockDeal(tx, session.dealId);
      const payment = await applyPayment(tx, {
        dealId: session.dealId,
        amount: session.amountSom,
        source: 'plum',
        paymentType: 'plum',
        adminUserId: null,
        note: null,
        provider: 'plum',
      });

      await tx
        .update(plumPaymentSessions)
        .set({ status: 'booked', paymentId: payment.paymentId, updatedAt: new Date() })
        .where(eq(plumPaymentSessions.id, session.id));

      const remainingDebt = await getRemainingDebt(tx, session.dealId);
      return { ...payment, remainingDebt };
    });

    // Outside the transaction, always — a push provider must never be able to
    // roll back a booked payment.
    await enqueuePaymentReceivedPush({
      userId: session.userId,
      paymentId: booked.paymentId,
      amount: session.amountSom,
      dealClosed: booked.dealClosed,
    });

    return {
      paymentId: booked.paymentId,
      amount: session.amountSom,
      remainingDebt: booked.remainingDebt,
      dealClosed: booked.dealClosed,
      booked: true,
    };
  } catch (err) {
    // Plum has the client's money and we could not allocate it — an
    // OverpaymentError from the millisecond race, or the database being
    // unreachable. This is NOT an error the client can act on, and telling them
    // the payment failed would be a lie about money that has already left their
    // card. Park it for a human and answer honestly: accepted, not yet booked.
    await db
      .update(plumPaymentSessions)
      .set({
        status: 'debited_unbooked',
        failureCode: err instanceof OverpaymentError ? 'overpayment' : 'booking_failed',
        updatedAt: new Date(),
      })
      .where(eq(plumPaymentSessions.id, session.id))
      // A failure to record the failure would erase the only pointer to the
      // money; nothing more can be done here but leave it in the logs.
      .catch(() => undefined);

    console.error('[plum-payment] debited but not booked', {
      sessionId: session.id,
      dealId: session.dealId,
      transactionId,
      amount: session.amountSom,
      err,
    });

    return {
      paymentId: null,
      amount: session.amountSom,
      remainingDebt: null,
      dealClosed: false,
      booked: false,
    };
  }
}

/** Terminal failure: releases the deal's live-payment slot. */
async function markSessionFailed(id: number, failureCode: string | null): Promise<void> {
  await db
    .update(plumPaymentSessions)
    .set({ status: 'failed', failureCode, updatedAt: new Date() })
    .where(eq(plumPaymentSessions.id, id))
    .catch(() => undefined);
}

/** The same, inside a caller's transaction — so the refusal and the release commit together. */
async function failWithin(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  id: number,
  failureCode: string,
): Promise<void> {
  await tx
    .update(plumPaymentSessions)
    .set({ status: 'failed', failureCode, updatedAt: new Date() })
    .where(eq(plumPaymentSessions.id, id));
}

/**
 * Free deals whose payer walked away mid-OTP.
 *
 * Only 'pending' rows are swept. A 'confirming' row is NOT expired here and that
 * is the whole point: we do not know whether Plum debited it, and quietly
 * retiring it would destroy the only record that a payment might be owed. Those
 * are escalated to `debited_unbooked` instead, where a human sees them.
 */
export async function sweepStalePlumSessions(): Promise<{ expired: number; escalated: number }> {
  const cutoff = new Date(Date.now() - PLUM_SESSION_TTL_MS);

  const expired = await db
    .update(plumPaymentSessions)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(
      and(eq(plumPaymentSessions.status, 'pending'), lt(plumPaymentSessions.createdAt, cutoff)),
    )
    .returning({ id: plumPaymentSessions.id });

  // A confirm that never came back. Rare — it needs a crash or a vendor hang in
  // the seconds between claiming the row and writing the outcome — but it is the
  // one case where money may be missing, so it goes in front of a person.
  const escalated = await db
    .update(plumPaymentSessions)
    .set({ status: 'debited_unbooked', failureCode: 'confirm_interrupted', updatedAt: new Date() })
    .where(
      and(eq(plumPaymentSessions.status, 'confirming'), lt(plumPaymentSessions.updatedAt, cutoff)),
    )
    .returning({ id: plumPaymentSessions.id });

  return { expired: expired.length, escalated: escalated.length };
}

/**
 * Book a payment Plum already took. The recovery action behind the admin stuck-
 * payments screen; it is the second half of confirmPlumPayment and nothing more.
 */
export async function bookStrandedPlumSession(sessionId: number): Promise<{ paymentId: number }> {
  const outcome = await db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(plumPaymentSessions)
      .where(eq(plumPaymentSessions.id, sessionId))
      .limit(1);
    if (!row) throw coded('payment_session_not_found', 404);
    if (row.status !== 'debited_unbooked') throw coded('payment_session_not_stranded', 409);

    await lockDeal(tx, row.dealId);
    const payment = await applyPayment(tx, {
      dealId: row.dealId,
      amount: row.amountSom,
      source: 'plum',
      paymentType: 'plum',
      adminUserId: null,
      // The one place a Plum row carries a note: without it nothing on the
      // payment itself says it was booked late, by hand, after a failure.
      note: `Восстановлен платёж Plum (транзакция ${row.plumTransactionId ?? '—'})`,
      provider: 'plum',
    });

    await tx
      .update(plumPaymentSessions)
      .set({ status: 'booked', paymentId: payment.paymentId, updatedAt: new Date() })
      .where(eq(plumPaymentSessions.id, row.id));

    return { row, payment };
  });

  await enqueuePaymentReceivedPush({
    userId: outcome.row.userId,
    paymentId: outcome.payment.paymentId,
    amount: outcome.row.amountSom,
    dealClosed: outcome.payment.dealClosed,
  });

  return { paymentId: outcome.payment.paymentId };
}

export interface PlumSessionListItem {
  id: number;
  userId: number;
  dealId: string;
  dealNumber: number | null;
  amount: number;
  status: PlumPaymentSessionStatus;
  plumTransactionId: string | null;
  failureCode: string | null;
  createdAt: Date;
}

/**
 * Sessions an operator may need to act on. Defaults to the stranded ones —
 * that is the only status this screen exists for.
 */
export async function listPlumSessions(
  statuses: PlumPaymentSessionStatus[] = ['debited_unbooked'],
): Promise<PlumSessionListItem[]> {
  return db
    .select({
      id: plumPaymentSessions.id,
      userId: plumPaymentSessions.userId,
      dealId: plumPaymentSessions.dealId,
      dealNumber: deals.dealNumber,
      amount: plumPaymentSessions.amountSom,
      status: plumPaymentSessions.status,
      plumTransactionId: plumPaymentSessions.plumTransactionId,
      failureCode: plumPaymentSessions.failureCode,
      createdAt: plumPaymentSessions.createdAt,
    })
    .from(plumPaymentSessions)
    .leftJoin(deals, eq(plumPaymentSessions.dealId, deals.id))
    .where(inArray(plumPaymentSessions.status, statuses))
    .orderBy(sql`${plumPaymentSessions.createdAt} desc`);
}
