import { sql } from 'drizzle-orm';
import { doublePrecision, integer, jsonb, pgTable, serial, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { dealSessions } from './deal-sessions';
import { users } from './users';

// ---------------------------------------------------------------------------
// scorings
// One row per deal_session — the orchestrator + final outcome of a scoring run.
// A run walks an ordered, cost-ascending list of knockout pipelines
// (myid → katm_077 → katm_inps); each is a scoring_pipelines child row. Cheap
// stop-factors short-circuit the run before any chargeable bureau call. Only
// once every pipeline passes does the numeric model run (separately) and stamp
// its result (score / credit_limit / criteria_scores) back here.
//
// status lifecycle:
//   in_progress → passed → scored        (happy path; 'passed' = gates cleared)
//   in_progress → rejected               (a stop-factor knocked out — terminal)
//   in_progress → error                  (vendor/system failure — terminal)
// A KATM pipeline may return 'pending' (async report); the run stays
// 'in_progress' and resolves in place when the BullMQ poll completes.
//
// Two run origins share this table (Client Scoring):
//   'merchant' — anchored on a deal_session (deal_session_id set), agent-driven.
//   'client'   — a user self-scoring in the mobile app (deal_session_id NULL,
//                user_id set), server-driven. See modules/client/scoring.
// ---------------------------------------------------------------------------
export const scorings = pgTable(
  'scorings',
  {
    id: serial('id').primaryKey(),
    // Set for merchant runs; NULL for client self-scoring runs (no deal).
    dealSessionId: uuid('deal_session_id').references(() => dealSessions.id),
    // Denormalized from the deal session for admin filtering. Required for
    // client runs (the run's only anchor when deal_session_id is NULL).
    userId: integer('user_id').references(() => users.id),
    // 'merchant' | 'client' — which entry point opened the run.
    origin: varchar('origin', { length: 10 }).notNull().default('merchant'),
    // 'in_progress' | 'passed' | 'scored' | 'rejected' | 'error'
    status: varchar('status', { length: 20 }).notNull().default('in_progress'),
    // The pipeline type currently in flight: 'myid' | 'katm_077' | 'katm_inps' | null when done.
    currentPipeline: varchar('current_pipeline', { length: 20 }),
    // Terminal rejection reason — mirrors the rejecting pipeline's code, or a
    // model-stage code ('model_stop_factor' | 'zero_limit'). Null unless rejected.
    rejectReasonCode: varchar('reject_reason_code', { length: 40 }),
    // Shared KATM claim for the run — registration is free; both 077 and inps
    // report fetches reference this one claimId.
    katmClaimId: varchar('katm_claim_id', { length: 20 }),
    // Model output, set when status reaches 'scored'.
    score: integer('score'),
    creditLimit: doublePrecision('credit_limit'),
    criteriaScores: jsonb('criteria_scores'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // One run per deal_session (merchant guarantee) and the target of the
    // startScoringRun upsert. NOT partial: Postgres treats NULLs as distinct, so
    // client runs (deal_session_id NULL) never collide here, and ON CONFLICT
    // (deal_session_id) can still infer this index.
    uniqueIndex('scorings_deal_session_idx').on(t.dealSessionId),
    // At most one in-flight client run per user — DB-level double-fire guard
    // against a user re-triggering chargeable KATM before the first resolves.
    uniqueIndex('scorings_client_inflight_idx')
      .on(t.userId)
      .where(sql`origin = 'client' AND status = 'in_progress'`),
  ],
);
