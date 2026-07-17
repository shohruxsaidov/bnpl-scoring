import { integer, pgTable, smallint, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

// ---------------------------------------------------------------------------
// app_ratings — how a client rates the mobile app itself, 1..5 stars.
//
// One row per user, upserted: a rating is the client's CURRENT opinion, not an
// event log. Re-rating overwrites, and no history is kept — so this table can
// answer "what do users think of the app now" and can never answer "did ratings
// move after release X". That was a deliberate call; adding history later means
// a new table, not a column.
//
// user_id is the primary key (same shape as user_credit_limits): the one-rating-
// per-user rule is the table's identity rather than a secondary constraint.
//
// The 1..5 range is enforced at the API boundary (TypeBox), not by a CHECK — a
// direct SQL write could store 9. Read paths must not assume the range holds.
// ---------------------------------------------------------------------------
export const appRatings = pgTable('app_ratings', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  rating: smallint('rating').notNull(),
  // First time this user rated. Preserved across re-rating (the upsert only
  // touches rating/updated_at), so the pair tells you "rated in March, changed
  // their mind in July" without keeping the old value.
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
