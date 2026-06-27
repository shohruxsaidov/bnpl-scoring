import { boolean, integer, jsonb, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { katmClaims } from './katm-claims';

// ---------------------------------------------------------------------------
// katm_mib_reports — KATM report 315 (Бюро принудительного исполнения).
// Checks whether the subject has active enforcement proceedings against them.
// Runs before 077 as a knockout stop-factor. The vendor wraps the payload as
// { report: { resultCode, resultMessage } } — far leaner than the 077 report —
// so we persist the inner result verbatim plus the derived pass/fail verdict.
//   resultCode 204 = "no data found" = PASS (clean). Other codes are mapped in
//   the evaluator; unknown codes route to needs-review, not auto-reject.
// ---------------------------------------------------------------------------
export const katmMibReports = pgTable('katm_mib_reports', {
  claimId: varchar('claim_id', { length: 20 })
    .primaryKey()
    .references(() => katmClaims.claimId),
  token: varchar('token'),
  demandId: varchar('demand_id'),
  consentId: varchar('consent_id'),
  // Inner report.resultCode (204 = no data found = pass).
  resultCode: integer('result_code'),
  // Inner report.resultMessage — the vendor's human-readable verdict.
  resultMessage: varchar('result_message'),
  // Derived verdict: true only for a confirmed PASS code.
  passed: boolean('passed'),
  raw: jsonb('raw'),
  status: varchar('status', { length: 20 }).notNull().default('created'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
