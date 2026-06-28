import { integer, jsonb, pgTable, serial, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { scorings } from './scorings';

// ---------------------------------------------------------------------------
// scoring_pipelines
// One row per executed pipeline within a scoring run, mutated in place (a
// 'pending' KATM row transitions to passed/rejected when its poll resolves).
// The unique (scoring_id, type) index enforces one row per pipeline type.
//
// Each pipeline has hardcoded stop-factors (in the codebase, not configurable):
//   myid      → address_absent, age_below, age_above
//   katm_077  → credit_ban, has_defaults, …
//   katm_inps → …
// All stop-factors are hard knockouts — the first one trips, the pipeline is
// rejected (reject_reason_code set), the run is terminal, no further charges.
//
// Three layers of data for the admin panel:
//   reject_reason_code — the verdict (set only on 'rejected')
//   summary            — the handful of evaluated fields the admin card shows up-front
//   raw                — the full self-contained pipeline payload, type-discriminated
// ---------------------------------------------------------------------------
export const scoringPipelines = pgTable(
  'scoring_pipelines',
  {
    id: serial('id').primaryKey(),
    scoringId: integer('scoring_id')
      .notNull()
      .references(() => scorings.id),
    // 'myid' | 'katm_077' | 'katm_inps'
    type: varchar('type', { length: 20 }).notNull(),
    // 'pending' | 'passed' | 'rejected' | 'error'
    status: varchar('status', { length: 20 }).notNull(),
    // Set only on 'rejected' — the hardcoded stop-factor code that knocked out.
    rejectReasonCode: varchar('reject_reason_code', { length: 40 }),
    // Extracted key fields rendered up-front on the admin card.
    summary: jsonb('summary'),
    // Full self-contained pipeline payload (myid row data / KATM result + vendor blob).
    raw: jsonb('raw'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('scoring_pipelines_scoring_type_idx').on(t.scoringId, t.type)],
);
