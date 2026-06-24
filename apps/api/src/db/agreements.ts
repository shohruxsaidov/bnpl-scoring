import { integer, pgTable, serial, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

// ---------------------------------------------------------------------------
// agreements — the auditable artifact behind pAgreementId/pAgreementDate
// (ADR-0025). One row per bureau-query consent: who consented, when, and
// through which run. The row id is sent as pAgreementId; there is no paper
// document.
// ---------------------------------------------------------------------------
export const agreements = pgTable('agreements', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  // The owning run — deal_sessions.id (no FK)
  sessionId: uuid('session_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
