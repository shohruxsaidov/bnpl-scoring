import { boolean, date, integer, pgTable, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { deals } from './deals';
import { manualPayments } from './manual-payments';

// ---------------------------------------------------------------------------
// deal_payment_schedules
// One row per instalment. Used by the Collection Board / Aging Bucket queries.
// Aging: dueDate <= today AND paid = false → determines Days Overdue.
// manualPaymentId is set when the row was settled by a Manual Payment event.
// ---------------------------------------------------------------------------
export const dealPaymentSchedules = pgTable('deal_payment_schedules', {
  id: serial('id').primaryKey(),
  dealId: uuid('deal_id')
    .notNull()
    .references(() => deals.id, { onDelete: 'cascade' }),
  index: integer('index').notNull(),
  dueDate: date('due_date').notNull(),
  amount: integer('amount').notNull(),
  /** Cumulative amount paid so far (tiyin). Fully paid when paidAmount >= amount. */
  paidAmount: integer('paid_amount')
    .notNull()
    .$defaultFn(() => 0),
  paid: boolean('paid').notNull().default(false),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  manualPaymentId: integer('manual_payment_id').references(
    () => manualPayments.id,
  ),
  paymentProvider: text('payment_provider').array(),
});
