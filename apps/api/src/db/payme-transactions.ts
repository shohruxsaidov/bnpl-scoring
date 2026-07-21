import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  smallint,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { deals } from './deals';
import { dealPayments } from './deal-payments';

// ---------------------------------------------------------------------------
// payme_transactions
// Payme's Merchant API state machine, mirrored. This table is PROTOCOL state,
// not business state: a row exists from CreateTransaction onward, but no money
// has touched the ledger until PerformTransaction inserts the deal_payments row
// and points `paymentId` at it. That ordering is the whole reason the mirror is
// a separate table — a pending Payme transaction must be invisible to the
// collection board and to every "what has this client paid" query.
//
// States (Payme's, not ours):
//    1  created   — reserved, awaiting Perform
//    2  performed — money booked
//   -1  cancelled from created
//   -2  cancelled after performed  ← NEVER WRITTEN. Reversal is out of scope;
//                                    CancelTransaction on a performed row is
//                                    refused with -31007.
//
// All four time columns are Unix MILLISECONDS, because that is what the wire
// speaks. They divide by origin:
//   paymeTime                              — params.time, Payme's own clock.
//   createTime / performTime / cancelTime  — ours, per the spec ("время в
//                                            биллинге мерчанта").
// Once written, none of them may be recomputed: Payme echoes them back during
// reconciliation and compares field-for-field, so a value that moves by a second
// is a mismatch to investigate. `createdAt` duplicates createTime as a real
// timestamptz purely so humans and the sweeper can query it normally.
// ---------------------------------------------------------------------------
export const PAYME_STATE = {
  CREATED: 1,
  PERFORMED: 2,
  CANCELLED: -1,
  CANCELLED_AFTER_PERFORM: -2,
} as const;

/** Payme's cancellation reasons. 4 = timeout, the only one we originate. */
export const PAYME_CANCEL_REASON = {
  RECIPIENT_NOT_FOUND: 1,
  DEBIT_ERROR: 2,
  TRANSACTION_ERROR: 3,
  TIMEOUT: 4,
  REFUND: 5,
  UNKNOWN: 10,
} as const;

/** A pending transaction older than this is dead per Payme's spec. */
export const PAYME_TIMEOUT_MS = 12 * 60 * 60 * 1000;

export const paymeTransactions = pgTable(
  'payme_transactions',
  {
    // Our own id. This is what GetStatement returns as `transaction` (stringified)
    // and Payme stores on its side forever — it must never be reassigned.
    id: serial('id').primaryKey(),
    // Payme's 24-char hex transaction id (params.id).
    paymeId: varchar('payme_id', { length: 30 }).notNull(),
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id),
    /** Exactly what Payme sent, in tiyin. Kept for reconciliation. */
    amountTiyin: bigint('amount_tiyin', { mode: 'number' }).notNull(),
    /** amountTiyin / 100 — the only unit the ledger ever sees. */
    amountSom: numeric('amount_som', { precision: 15, scale: 2, mode: 'number' }).notNull(),
    /** The raw params.account object, verbatim, for support forensics. */
    account: jsonb('account').notNull(),
    state: smallint('state').notNull().default(PAYME_STATE.CREATED),
    /** Payme's cancellation reason; null while the row is alive. */
    reason: integer('reason'),
    /** params.time — the payer's transaction time, per Payme. Unix ms. */
    paymeTime: bigint('payme_time', { mode: 'number' }).notNull(),
    /** Unix ms. Set at CreateTransaction; echoed in every later response. */
    createTime: bigint('create_time', { mode: 'number' }).notNull(),
    /** Unix ms. Zero until performed — Payme wants 0, not null, in responses. */
    performTime: bigint('perform_time', { mode: 'number' }).notNull().default(0),
    /** Unix ms. Zero until cancelled. */
    cancelTime: bigint('cancel_time', { mode: 'number' }).notNull().default(0),
    // The ledger row this transaction booked. Null until Perform — a null here
    // on a state=2 row would mean money was acknowledged but never allocated.
    paymentId: integer('payment_id').references(() => dealPayments.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Idempotency. Every method keys off params.id; concurrent duplicates are
    // arbitrated here rather than by a read-then-write race in the handler.
    uniqueIndex('payme_transactions_payme_id_uq').on(t.paymeId),
    // One pending transaction per deal. Without this, a payer with checkout open
    // on two devices can Perform twice, and the second Perform overshoots the
    // remaining debt — a bound that was checked at Check time, hours earlier.
    uniqueIndex('payme_transactions_deal_pending_uq')
      .on(t.dealId)
      .where(sql`state = 1`),
    // GetStatement scans a time window.
    index('payme_transactions_create_time_idx').on(t.createTime),
    index('payme_transactions_deal_idx').on(t.dealId),
  ],
);
