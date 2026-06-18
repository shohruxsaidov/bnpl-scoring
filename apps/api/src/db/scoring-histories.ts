import { integer, jsonb, numeric, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';
import { scoringModelRevisions } from './scoring-model-revisions';
import { users } from './users';

// ---------------------------------------------------------------------------
// scoring_histories
// One row per scoring run. No FK constraints — client/deal data is snapshotted
// at scoring time so records remain accurate even if linked rows change.
// ---------------------------------------------------------------------------
export const scoringHistories = pgTable('scoring_histories', {
  id: serial('id').primaryKey(),
  // Link to users row (nullable — self-service scoring has no merchant-scoped user)
  userId: integer('client_id').references(() => users.id),
  // Client snapshot at scoring time
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  middleName: varchar('middle_name', { length: 100 }),
  passportNumber: varchar('passport_number', { length: 10 }),
  passportSeries: varchar('passport_series', { length: 5 }),
  pinfl: varchar('pinfl', { length: 14 }),
  phoneNumber: varchar('phone_number', { length: 20 }),
  // Full per-criterion breakdown: { income, workPeriod, creditHistory, overdues, liabilities, demographics, cardScore }
  criteriaScores: jsonb('criteria_scores'),
  scoreSum: numeric('score_sum', { precision: 10, scale: 2 }),
  // Coefficient from the global coefficient table: 0 = denied, 0.8 = partial, 1.0 = full
  coefficient: numeric('coefficient', { precision: 5, scale: 4 }),
  // 'approved' | 'declined' | 'manual_review'
  decision: varchar('decision', { length: 20 }).notNull(),
  // Scoring Model Revision that produced this decision; null for runs predating
  // the global-model audit trail (ADR 0021) or scored outside the model engine
  modelRevisionId: integer('model_revision_id').references(() => scoringModelRevisions.id),
  platformCreditLimit: integer('platform_credit_limit').notNull(),
  scoredAt: timestamp('scored_at', { withTimezone: true }).defaultNow().notNull(),
});
