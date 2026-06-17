import { jsonb, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const scoringTestCases = pgTable('scoring_test_cases', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  inputs: jsonb('inputs').notNull(),
  expectedOutcome: varchar('expected_outcome', { length: 20 }).notNull(), // 'approved' | 'partial' | 'denied' | 'rejected'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
