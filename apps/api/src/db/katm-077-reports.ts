import { boolean, doublePrecision, integer, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { katmClaims } from './katm-claims';

export const katm077Reports = pgTable('katm_077_reports', {
  claimId: varchar('claim_id', { length: 20 })
    .primaryKey()
    .references(() => katmClaims.claimId),
  token: varchar('token'),
  demandId: varchar('demand_id'),
  consentId: varchar('consent_id'),
  score: integer('score'),
  scoringClass: varchar('scoring_class'),
  scoringLevel: varchar('scoring_level'),
  activeLoans: integer('active_loans'),
  allDebtSum: doublePrecision('all_debt_sum'),
  overdueCount: integer('overdue_count'),
  overdueAmount: doublePrecision('overdue_amount'),
  maxOverdueDays: integer('max_overdue_days'),
  totalContracts: integer('total_contracts'),
  totalClaims: integer('total_claims'),
  avgMonthlyPayment: doublePrecision('avg_monthly_payment'),
  hasDefaults: boolean('has_defaults'),
  hasCreditBan: boolean('has_credit_ban'),
  raw: jsonb('raw'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
