import { sql } from 'drizzle-orm';
import {
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
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
//   'plum'   — a client paid from a saved card in the mobile app; booked by
//              POST /client/payments/confirm once Plumgate's OTP clears. Like
//              'payme', machine-booked and adminUserId null.
//
// `paymentDate` is the VALUE date — the day the money actually moved, which for
// a manual row is whatever the operator read off the MIB statement, not when
// they typed it in. `createdAt` remains the booking instant, so the two diverge
// exactly when a human backdated and that gap is the audit signal. Machine rails
// book synchronously, so their two dates always agree.
//
// `paymentType` stays the human sub-kind of a manual payment
// ('replenishment' | 'writing_off' — both are money-in labels, they only say
// how the operator booked it); machine rails write their own name into it so a
// single-column read still tells an operator what happened. Rows written before
// 2026-07-22 carry the retired 'mib' / 'transfer' labels.
// ---------------------------------------------------------------------------
export type DealPaymentSource = 'manual' | 'payme' | 'plum';

export const dealPayments = pgTable('deal_payments', {
  id: serial('id').primaryKey(),
  dealId: uuid('deal_id')
    .notNull()
    .references(() => deals.id, { onDelete: 'cascade' }),
  // Null for machine-booked payments — nobody signed off on a Payme row.
  adminUserId: integer('admin_user_id').references(() => adminUsers.id),
  /** Payment amount, in som. */
  amount: numeric('amount', { precision: 15, scale: 2, mode: 'number' }).notNull(),
  /**
   * Value date, `YYYY-MM-DD`. A plain date, not a timestamp: an operator copying
   * a bank statement knows the day and nothing finer, and this stays the same
   * type as deal_payment_schedules.dueDate so "paid on time?" needs no timezone
   * reasoning. The DB default only covers the migration of pre-existing rows —
   * applyPayment always sends a value.
   */
  paymentDate: date('payment_date').notNull().default(sql`CURRENT_DATE`),
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
