import { doublePrecision, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { katmClaims } from './katm-claims';

export const katmInpsReports = pgTable('katm_inps_reports', {
  claimId: varchar('claim_id', { length: 20 })
    .primaryKey()
    .references(() => katmClaims.claimId),
  token: varchar('token'),
  demandId: varchar('demand_id'),
  incomesAllSumma: doublePrecision('incomes_all_summa'),
  periodBegin: varchar('period_begin'),
  periodEnd: varchar('period_end'),
  incomes: jsonb('incomes'),
  raw: jsonb('raw'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
