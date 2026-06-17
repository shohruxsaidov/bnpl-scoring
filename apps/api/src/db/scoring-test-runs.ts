import { integer, jsonb, pgTable, serial, timestamp } from 'drizzle-orm/pg-core';
import { scoringModelRevisions } from './scoring-model-revisions';

export const scoringTestRuns = pgTable('scoring_test_runs', {
  id: serial('id').primaryKey(),
  modelRevisionId: integer('model_revision_id')
    .notNull()
    .references(() => scoringModelRevisions.id),
  ranAt: timestamp('ran_at', { withTimezone: true }).defaultNow().notNull(),
  passCount: integer('pass_count').notNull(),
  failCount: integer('fail_count').notNull(),
  results: jsonb('results').notNull(), // array of { testCaseId, name, expectedOutcome, actualOutcome, totalScore, coefficient, breakdown, pass }
});
