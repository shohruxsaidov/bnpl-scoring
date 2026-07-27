import { sweepStalePlumSessions } from './pay.service';

/**
 * Plum payment-session timeout sweep (BullMQ).
 *
 * Same hole the Payme sweeper closes, for the same reason: a client who starts a
 * payment and never types the OTP generates no further calls, so nothing lazily
 * expires their session — while the one-live-payment-per-deal index keeps every
 * other attempt on that credit blocked. Without this job they are locked out of
 * paying by a session they have forgotten about.
 *
 * It also escalates sessions stuck mid-confirm to `debited_unbooked`. That half
 * is not cleanup: those are the rows where Plum may hold money we never booked,
 * and the sweep is what puts them in front of a human.
 */
export const PLUM_PAYMENT_SWEEP_QUEUE = 'plum-payment-session-sweep';
export const PLUM_PAYMENT_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 min
/** Stable id so re-registering on boot replaces rather than duplicates. */
export const PLUM_PAYMENT_SWEEP_JOB_ID = 'plum-payment-sweep';

export async function processPlumPaymentSweepJob(): Promise<{
  expired: number;
  escalated: number;
}> {
  return sweepStalePlumSessions();
}
