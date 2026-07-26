import { index, integer, pgTable, serial, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { deals } from './deals';
import { dealSessions } from './deal-sessions';
import { merchants } from './merchants';
import { merchantUsers } from './merchant-users';
import { scorings } from './scorings';
import { userCards } from './user-cards';
import { users } from './users';

// ---------------------------------------------------------------------------
// client_actions — the append-only milestone trail behind the Действия tab on
// the admin client page.
//
// WHAT BELONGS HERE. An action earns a row if it CHANGES WHAT THE CLIENT IS
// ENTITLED TO, or if it is EVIDENCE OF CONSENT. Registration, adding or removing
// a card, a scoring run's verdict, and the two signing gates all pass that test.
// Logins, session refreshes, reading a notification and opening a screen all
// fail it — they are ambient noise, and at three logins a day they would bury
// the handful of rows anyone actually opens this tab to find. Resist the pull to
// make this "everything the client did"; there is no cheaper place to put the
// line than right here.
//
// WHY IT EXISTS AT ALL, given users/user_cards/scorings already carry their own
// timestamps: the two signing gates had NO durable record before this table.
// deal_sessions.step_data.signing is mutable — rejectSigningRequest deletes the
// block and a re-scan overwrites it — and `deals` never copied it. A client who
// face-scanned, was rejected, and scanned again used to leave nothing behind.
//
// SUCCESS AND FAILURE both get rows. A failed row's only payload is
// `reasonCode`, because the entity it would have pointed at was never created —
// a bad Plumgate OTP writes no user_cards row, so `userCardId` stays null on the
// row support most wants to click.
//
// REGISTRATION IS SUCCESS-ONLY, and that is structural, not an oversight. Every
// registration failure (wrong OTP, MyID PINFL mismatch, abandoned after the
// face-scan) happens BEFORE the users row exists, so it has no user_id to hang
// on and no client page to be rendered under. Funnel drop-off is a different
// feature — an admin registrations screen — not a nullable FK here.
// ---------------------------------------------------------------------------

export type ClientActionType =
  | 'registration'
  | 'card_add'
  | 'card_delete'
  | 'scoring'
  | 'deal_sign_myid'
  | 'deal_sign_otp'
  | 'deal_sign_reject';

export type ClientActionStatus = 'success' | 'failed';

/**
 * Who performed the action.
 *   'client' — the client themselves, in the mobile app or on their own phone
 *   'agent'  — a merchant employee acting on the client's behalf at a counter
 *   'system' — no human: a background worker, or a backfilled historical row
 *
 * Worth a column rather than an inference: `card_add` has three call sites, two
 * client-driven and one where an AGENT types the card number at a counter, and
 * "did the client add that card or did a shop employee?" is exactly the question
 * a disputed card turns on.
 */
export type ClientActionActor = 'client' | 'agent' | 'system';

/**
 * The surface the action happened on. Only the signing gates populate it, and
 * only because there the ACTOR is the client either way: 'counter' means they
 * tapped through on the agent's tablet with the agent watching, 'remote' means
 * it happened on their own phone. Those are different stories about consent.
 */
export type ClientActionChannel = 'counter' | 'remote';

export const clientActions = pgTable(
  'client_actions',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    action: varchar('action', { length: 30 }).notNull().$type<ClientActionType>(),
    status: varchar('status', { length: 10 }).notNull().$type<ClientActionStatus>(),
    // Why a failed action failed. Scoring reuses the scorings.reject_reason_code
    // vocabulary so the admin portal can translate both from one i18n map;
    // vendor codes (Plumgate, MyID) arrive untranslated and render raw, which is
    // still more use to support than a blank cell.
    reasonCode: varchar('reason_code', { length: 40 }),

    actorType: varchar('actor_type', { length: 10 }).notNull().$type<ClientActionActor>(),
    // The merchant employee, when actorType is 'agent'.
    actorId: integer('actor_id').references(() => merchantUsers.id),
    merchantId: integer('merchant_id').references(() => merchants.id),
    channel: varchar('channel', { length: 10 }).$type<ClientActionChannel>(),

    // What it happened to. All nullable by design: this is a heterogeneous table
    // and most cells are empty on most rows.
    dealSessionId: uuid('deal_session_id').references(() => dealSessions.id),
    // Stamped LATER than the row itself: signing happens on a deal_session, and
    // the Deal does not exist until the Agent presses Создать сделку. Deal
    // creation backfills it onto the session's signing rows, which is what turns
    // them into something an admin can click — deal sessions have no admin page.
    dealId: uuid('deal_id').references(() => deals.id),
    scoringId: integer('scoring_id').references(() => scorings.id),
    userCardId: integer('user_card_id').references(() => userCards.id, { onDelete: 'set null' }),

    // Per-action opt-in idempotency, same trick as notifications.dedupe_key:
    // unique but nullable, and Postgres treats NULLs as distinct. 'scoring:<id>'
    // stops a retrying KATM poller writing a second verdict row. The signing
    // gates deliberately pass NO key — repeat attempts are the whole history.
    dedupeKey: varchar('dedupe_key', { length: 120 }).unique(),

    // occurredAt is DOMAIN time (when the client did it) and is what the tab
    // sorts and shows. createdAt is ROW time. They agree to the millisecond on
    // live writes and differ by months on backfilled rows — that gap is the
    // provenance signal, which is why there is no separate `backfilled` flag.
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // The tab's only query — newest-first per client.
    index('client_actions_user_occurred_idx').on(t.userId, t.occurredAt.desc()),
  ],
);

export type ClientActionRow = typeof clientActions.$inferSelect;
