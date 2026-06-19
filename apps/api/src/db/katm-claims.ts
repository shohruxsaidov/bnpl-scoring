import { integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

// ---------------------------------------------------------------------------
// katm_claims — one row per successful KATM claim registration (ADR-0025).
// Tracks the claim lifecycle: created on successful v1/claim/registration,
// token populated when the report is async (05050). session_id has no FK
// because it is polymorphic (deal_sessions or scoring_sessions).
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
  // Null when the report resolved synchronously (no polling needed)
  token: varchar('token'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
