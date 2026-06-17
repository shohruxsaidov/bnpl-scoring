import { date, integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

export const scoringSessions = pgTable('scoring_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  consentId: varchar('consent_id', { length: 100 }).notNull(),
  consentDate: date('consent_date').notNull(),
  // 'pending' | 'running' | 'completed' | 'failed'
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  // KATM Claim ID (ADR-0025) — drawn from the shared katm_claim_seq when the
  // bureau claim is registered. ≤20 chars; the session UUID does not fit pClaimId.
  katmClaimId: varchar('katm_claim_id', { length: 20 }),
  scoredAt: timestamp('scored_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
