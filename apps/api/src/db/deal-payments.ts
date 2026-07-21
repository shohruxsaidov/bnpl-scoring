import { integer, numeric, pgTable, serial, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { deals } from './deals';
import { adminUsers } from './admin-users';

// ---------------------------------------------------------------------------
// deal_payments  (was `manual_payments` until Payme landed)
//
// One row per money-in event against a Deal, whatever the rail. Every row is
// allocated across instalments FIFO by dueDate — see payment_allocations, which
// records the per-instalment split this row caused. Amount in som.
//
// `source` says who initiated the money movement, not how it arrived:
//   'manual' — a Platform Admin recorded it by hand (adminUserId set)
//   'payme'  — a client paid through Payme; booked by PerformTransaction, so
//              adminUserId is null and no human is accountable for the row.
//
// `paymentType` stays the human sub-kind of a manual payment ('mib' |
// 'transfer'); machine rails write their own name into it so a single-column
// read still tells an operator what happened.
// ---------------------------------------------------------------------------
export type DealPaymentSource = 'manual' | 'payme';

export const dealPayments = pgTable('deal_payments', {
  id: serial('id').primaryKey(),
  dealId: uuid('deal_id')
    .notNull()
    .references(() => deals.id, { onDelete: 'cascade' }),
  // Null for machine-booked payments — nobody signed off on a Payme row.
  adminUserId: integer('admin_user_id').references(() => adminUsers.id),
  /** Payment amount, in som. */
  amount: numeric('amount', { precision: 15, scale: 2, mode: 'number' }).notNull(),
  source: varchar('source', { length: 20 })
    .$type<DealPaymentSource>()
    .notNull()
    .default('manual'),
  paymentType: text('payment_type').notNull().default('mib'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Back-compat alias. The table was renamed, not split — every former
 * manual_payments row is a deal_payments row with source='manual'.
 * @deprecated import `dealPayments`.
 */
export const manualPayments = dealPayments;
