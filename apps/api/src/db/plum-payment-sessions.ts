import { sql } from 'drizzle-orm';
import {
  bigint,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users';
import { deals } from './deals';
import { dealPayments } from './deal-payments';

// ---------------------------------------------------------------------------
// plum_payment_sessions
// Plumgate's card-payment OTP handshake, mirrored. Like payme_transactions this
// is PROTOCOL state, not business state: a row exists from the moment the OTP is
// sent, but no money has touched the ledger until `payment_id` points at a
// deal_payments row.
//
// WHY THE ROW MUST EXIST AT ALL. The handshake is two calls separated by however
// long the client takes to read an SMS, and Plum's confirmPayment answers with a
// bare `transactionId` — it echoes back neither the amount nor our extraId. So if
// the deal and the amount were not recorded at step one, step two would have to
// take the client's word for both, and a client who initiated a 500 000 som debit
// could ask us to book 5 000 against a deal of their choosing. Everything the
// confirm step needs is read from THIS row; the request body contributes only the
// session and the OTP.
//
// STATUSES
//   pending          — OTP sent, awaiting confirmation. Holds the deal's slot.
//   confirming       — the OTP was accepted by us and handed to Plum. Transient,
//                      and the only state where we do not know whether the card
//                      was debited (see debited_unbooked).
//   booked           — money allocated; `payment_id` set. Terminal.
//   failed           — Plum refused, or the debt moved under the payer before we
//                      handed the OTP over. No debit happened. Terminal.
//   expired          — nobody ever confirmed; swept so the deal's slot is freed.
//   debited_unbooked — PLUM TOOK THE MONEY AND WE COULD NOT BOOK IT. The one
//                      status a human must resolve: `plum_transaction_id`,
//                      `deal_id` and `amount_som` together carry everything a
//                      retry needs. Never swept, never auto-expired.
//
// Amounts are in som, matching deal_payments and every client-facing surface.
// ---------------------------------------------------------------------------
export type PlumPaymentSessionStatus =
  | 'pending'
  | 'confirming'
  | 'booked'
  | 'failed'
  | 'expired'
  | 'debited_unbooked';

export const plumPaymentSessions = pgTable(
  'plum_payment_sessions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // No cascade, matching payme_transactions: a deal carrying a record of money
    // taken from a card must not be deletable out from under it.
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id),
    // user_cards.plum_id — Plumgate's «идентификатор прикрепления», the same id
    // DELETE UserCard/deleteUserCard takes and the same one GET /client/cards
    // hands the app. Deliberately NOT an FK: removing a card must not erase the
    // record of a payment made with it.
    cardId: integer('card_id').notNull(),
    /** In som. */
    amountSom: numeric('amount_som', { precision: 15, scale: 2, mode: 'number' }).notNull(),
    // Our reference, generated per attempt and sent to Plum as `extraId`. The
    // only key that ties a disputed charge on Plum's side back to the request
    // that caused it, which is why it is stored rather than generated inline.
    extraId: uuid('extra_id').notNull(),
    // Plum's session handle, returned by Payment/payment. Null until that call
    // returns — the row is inserted first, so the deal's slot is claimed before
    // any OTP is sent.
    plumSession: bigint('plum_session', { mode: 'number' }),
    // Plum's transactionId from confirmPayment. Written the instant it arrives,
    // BEFORE the booking transaction is attempted — it is the only evidence the
    // card was debited, and a crash must not lose it.
    plumTransactionId: varchar('plum_transaction_id', { length: 64 }),
    // The ledger row this session booked. Null until booked; a null here on a
    // 'booked' row would mean money acknowledged but never allocated.
    paymentId: integer('payment_id').references(() => dealPayments.id),
    status: varchar('status', { length: 20 })
      .$type<PlumPaymentSessionStatus>()
      .notNull()
      .default('pending'),
    // Plum's own error code (e.g. '-111'), kept so support can answer "why did my
    // payment fail" without digging through integration_logs.
    failureCode: varchar('failure_code', { length: 40 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // One live payment per deal — the same guard payme_transactions applies, for
    // the same reason: a client with the app open on two devices would otherwise
    // burn an OTP per attempt and collect a 409 on each one they confirmed
    // second. 'confirming' is included because a row mid-handshake has an OTP in
    // the client's hands and is every bit as live as a pending one.
    uniqueIndex('plum_payment_sessions_deal_live_uq')
      .on(t.dealId)
      .where(sql`status in ('pending', 'confirming')`),
    // Reconciliation key against Plum.
    uniqueIndex('plum_payment_sessions_extra_id_uq').on(t.extraId),
    // The confirm step looks a session up by this alone (then checks ownership),
    // so it must never match two rows.
    uniqueIndex('plum_payment_sessions_plum_session_uq')
      .on(t.plumSession)
      .where(sql`plum_session is not null`),
    // The sweeper scans live rows by age; the admin stuck-payments screen scans
    // by status.
    index('plum_payment_sessions_status_created_idx').on(t.status, t.createdAt),
    index('plum_payment_sessions_user_idx').on(t.userId, t.createdAt.desc()),
  ],
);
