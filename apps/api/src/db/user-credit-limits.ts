import { bigint, integer, pgTable, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';
import { scorings } from './scorings';

// ---------------------------------------------------------------------------
// user_credit_limits — the client's current headline credit limit (Client
// Scoring). One row per user; upserted whenever a client scoring run reaches a
// terminal outcome. The full run/pipeline audit trail lives in scorings /
// scoring_pipelines — this table is just the current value the mobile app shows.
//
// credit_limit is in tiyin (0 on any rejection). Within [scored_at, expires_at)
// the value is reused and a re-score is skipped (no fresh KATM charge); after
// expires_at the app offers a manual refresh.
// ---------------------------------------------------------------------------
export const userCreditLimits = pgTable('user_credit_limits', {
  userId: integer('user_id')
    .primaryKey()
    .references(() => users.id),
  // Per-month disposable figure in tiyin, as produced by runModelAndLimit.
  // 0 on any rejection (the reason lives on the scorings run).
  creditLimit: bigint('credit_limit', { mode: 'number' }).notNull(),
  // The run that produced this value.
  scoringId: integer('scoring_id').references(() => scorings.id),
  scoredAt: timestamp('scored_at', { withTimezone: true }).notNull(),
  // scored_at + TTL. Re-score allowed once now >= expires_at.
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
