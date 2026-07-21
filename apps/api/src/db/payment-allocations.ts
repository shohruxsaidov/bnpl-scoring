import { index, integer, numeric, pgTable, serial } from 'drizzle-orm/pg-core';
import { dealPayments } from './deal-payments';
import { dealPaymentSchedules } from './deal-payment-schedules';

// ---------------------------------------------------------------------------
// payment_allocations
// The split a single payment caused across instalments: one row per instalment
// it touched, holding the exact som applied to that instalment.
//
// Why this exists: deal_payment_schedules carries a cumulative `paidAmount` and
// ONE `manual_payment_id`. When a second payment lands on a row the first
// already partially covered, that FK is overwritten and the first payment's
// contribution becomes unrecoverable. So "who paid this instalment" was
// unanswerable, and — the reason it now matters — a reversal was uncomputable.
//
// Nothing reads these rows today: reversal is deliberately out of scope, and
// Payme cancellation of a performed transaction is refused with -31007. They are
// written anyway because the split cannot be reconstructed after the fact; the
// day reversal is built, the history has to already be there.
// ---------------------------------------------------------------------------
export const paymentAllocations = pgTable(
  'payment_allocations',
  {
    id: serial('id').primaryKey(),
    paymentId: integer('payment_id')
      .notNull()
      .references(() => dealPayments.id, { onDelete: 'cascade' }),
    scheduleId: integer('schedule_id')
      .notNull()
      .references(() => dealPaymentSchedules.id, { onDelete: 'cascade' }),
    /** Som applied to this instalment by this payment. Always > 0. */
    amount: numeric('amount', { precision: 15, scale: 2, mode: 'number' }).notNull(),
  },
  (t) => [
    // Reversal reads by payment; "who paid this instalment" reads by schedule.
    index('payment_allocations_payment_idx').on(t.paymentId),
    index('payment_allocations_schedule_idx').on(t.scheduleId),
  ],
);
