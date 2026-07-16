import { integer, numeric, pgTable, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { deals } from './deals';
import { adminUsers } from './admin-users';

// ---------------------------------------------------------------------------
// manual_payments
// A single Platform Admin payment event that settles one or more instalments
// FIFO by dueDate. Amount stored in som.
// ---------------------------------------------------------------------------
export const manualPayments = pgTable('manual_payments', {
  id: serial('id').primaryKey(),
  dealId: uuid('deal_id')
    .notNull()
    .references(() => deals.id, { onDelete: 'cascade' }),
  adminUserId: integer('admin_user_id').references(() => adminUsers.id),
  /** Payment amount, in som. */
  amount: numeric('amount', { precision: 15, scale: 2, mode: 'number' }).notNull(),
  paymentType: text('payment_type').notNull().default('mib'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
