import { integer, jsonb, pgTable, serial, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { scoringSessions } from './scoring-sessions';

export const scoringPipelines = pgTable('scoring_pipelines', {
  id: serial('id').primaryKey(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => scoringSessions.id),
  // 'katm' | 'card_scoring'
  type: varchar('type', { length: 20 }).notNull(),
  // 'pending' | 'running' | 'completed' | 'failed'
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  result: jsonb('result'),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});
