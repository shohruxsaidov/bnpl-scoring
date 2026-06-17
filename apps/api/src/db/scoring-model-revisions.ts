import { integer, jsonb, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { scoringModels } from './scoring-models';
import { adminUsers } from './admin-users';

// scoringModelId is nullable only so the column can be added to a populated
// table; the backfill script attaches every orphan revision to the Global
// Model, and all write paths set it.
export const scoringModelRevisions = pgTable('scoring_model_revisions', {
  id: serial('id').primaryKey(),
  scoringModelId: integer('scoring_model_id').references(() => scoringModels.id),
  name: text('name').notNull(),
  version: varchar('version', { length: 50 }).notNull(),
  params: jsonb('params').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: integer('created_by').references(() => adminUsers.id),
});
