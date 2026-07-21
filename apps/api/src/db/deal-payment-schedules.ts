import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { deals } from './deals';
import { dealPayments } from './deal-payments';

// ---------------------------------------------------------------------------
// deal_payment_schedules
// One row per instalment. Used by the Collection Board / Aging Bucket queries.
// Aging: dueDate <= today AND paid = false → determines Days Overdue.
//
// manualPaymentId points at the LAST payment to touch this instalment (the
// column predates deal_payments and keeps its old name to avoid a rename on a
// live table). It is lossy by construction — a second payment overwrites the
// first — so it is a convenience pointer, never an audit trail. The exact split
// lives in payment_allocations.
// ---------------------------------------------------------------------------
export const dealPaymentSchedules = pgTable('deal_payment_schedules', {
  id: serial('id').primaryKey(),
  dealId: uuid('deal_id')
    .notNull()
    .references(() => deals.id, { onDelete: 'cascade' }),
  index: integer('index').notNull(),
  dueDate: date('due_date').notNull(),
  /** Instalment amount, in som. */
  amount: numeric('amount', { precision: 15, scale: 2, mode: 'number' }).notNull(),
  /** Cumulative amount paid so far, in som. Fully paid when paidAmount >= amount. */
  paidAmount: numeric('paid_amount', { precision: 15, scale: 2, mode: 'number' })
    .notNull()
    .$defaultFn(() => 0),
  paid: boolean('paid').notNull().default(false),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  manualPaymentId: integer('manual_payment_id').references(
    () => dealPayments.id,
  ),
  paymentProvider: text('payment_provider').array(),
});
