import { boolean, integer, pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';
import { adminUsers } from './admin-users';

// ---------------------------------------------------------------------------
// scoring_pipeline_settings
// The global ops kill-switch: one row per configurable pipeline, keyed by the
// same `type` string as scoring_pipelines.type.
//
// This is an OPS layer, not a scoring-policy layer — it answers "may we call
// this vendor at all" (integration down, contract not signed). Whether a given
// model's score *depends* on that data is a separate, versioned decision that
// lives on the model revision. See modules/scoring/pipelines/config.ts.
//
// A pipeline with NO row here falls back to DEFAULT_PIPELINE_ENABLED, so the
// table needs no seed migration and adding a pipeline needs no schema change.
// Absence means "default", not "disabled" — do not read a missing row as false.
// ---------------------------------------------------------------------------
export const scoringPipelineSettings = pgTable('scoring_pipeline_settings', {
  // 'myid' | 'katm_mib' | 'katm_077' | 'katm_inps' — CONFIGURABLE_PIPELINES.
  type: varchar('type', { length: 20 }).primaryKey(),
  enabled: boolean('enabled').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  updatedBy: integer('updated_by').references(() => adminUsers.id),
});
