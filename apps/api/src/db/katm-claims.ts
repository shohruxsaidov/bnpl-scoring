import { integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

// ---------------------------------------------------------------------------
// katm_claims — one row per successful KATM claim registration (ADR-0025).
// Tracks claim registration only. The report and its polling token live in
// katm_reports. session_id has no FK because it is polymorphic
// (deal_sessions or scoring_sessions).
// ---------------------------------------------------------------------------
export const katmClaims = pgTable('katm_claims', {
  claimId: varchar('claim_id', { length: 20 }).primaryKey(),
  // 'created' only for now; 'approved' | 'cancelled' reserved for future use
  status: varchar('status', { length: 20 }).notNull().default('created'),
  channel: varchar('channel', { length: 20 }).notNull(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  sessionId: uuid('session_id').notNull(),
  katmSir: varchar('katm_sir').notNull(),
  verified: jsonb('verified').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
