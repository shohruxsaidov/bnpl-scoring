import { jsonb, pgTable, serial, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { dealSessions } from './deal-sessions';

// ---------------------------------------------------------------------------
// deal_session_events
// Append-only: one row per step submission (redone steps included) plus the
// server-stamped 'katm' and 'scoring' events. Serves funnel analytics and the
// audit trail; never updated or deleted. Retention deliberately deferred (ADR-0024).
// ---------------------------------------------------------------------------
export const dealSessionEvents = pgTable('deal_session_events', {
  id: serial('id').primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => dealSessions.id, { onDelete: 'cascade' }),
  step: varchar('step', { length: 20 }).notNull(),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
