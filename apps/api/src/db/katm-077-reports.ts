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
  // Any contract under judicial collection / written off (all-time). Hard reject
  // via the judicial_or_decommissioned stop-factor.
  hasJuridical: boolean('has_juridical'),
  hasDecommission: boolean('has_decommission'),
  overdue30Count: integer('overdue_30_count'),
  overdue30to60Count: integer('overdue_30_to_60_count'),
  overdue60to90Count: integer('overdue_60_to_90_count'),
  overdue90Count: integer('overdue_90_count'),
  // Max overdue principal days across the subject's contingent liabilities
  // (loans where they are a third party). null = not a pledger. Feeds the
  // engine's PledgerLiability criterion.
  pledgerLiability: integer('pledger_liability'),
  raw: jsonb('raw'),
  status: varchar('status', { length: 20 }).notNull().default('created'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
