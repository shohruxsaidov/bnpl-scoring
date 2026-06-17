import { integer, pgTable, serial, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { clients } from './clients';
import { users } from './users';

// ---------------------------------------------------------------------------
// agreements — the auditable artifact behind pAgreementId/pAgreementDate
// (ADR-0025). One row per bureau-query consent: who consented, when, through
// which run, and via which channel. The row id is sent as pAgreementId; there
// is no paper document.
// ---------------------------------------------------------------------------
export const agreements = pgTable('agreements', {
  id: serial('id').primaryKey(),
  // Exactly one of the two subjects is set, matching the channel
  clientId: integer('client_id').references(() => clients.id),
  userId: integer('user_id').references(() => users.id),
  // 'wizard' | 'self_service'
  channel: varchar('channel', { length: 20 }).notNull(),
  // The owning run — deal_sessions.id or scoring_sessions.id (no FK: the
  // scoring session row is created after the consent in the self-service flow)
  sessionId: uuid('session_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
