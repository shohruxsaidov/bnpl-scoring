import { expireStalePendingTransactions } from './methods';

/**
 * Payme pending-transaction timeout sweep (BullMQ).
 *
 * The active half of timeout enforcement. Each method already expires a stale
 * transaction it happens to touch, and Payme's sandbox verifies that — but lazy
 * expiry alone leaves a real hole: a payer who opens checkout and walks away
 * generates no further calls, so nothing ever runs the lazy check, while the
 * one-pending-per-deal index keeps every other payment attempt on that deal
 * blocked. The client is locked out of paying, indefinitely, by a transaction
 * that no longer exists as far as they are concerned.
 *
 * This job is what actually frees them. Cadence is well under the 12h window it
 * enforces, so the worst-case lock is 12h plus one tick.
 */
export const PAYME_SWEEP_QUEUE = 'payme-transaction-sweep';
export const PAYME_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 min
/** Stable id so re-registering on boot replaces rather than duplicates. */
export const PAYME_SWEEP_JOB_ID = 'payme-sweep';

export async function processPaymeSweepJob(): Promise<number> {
  return expireStalePendingTransactions();
}
