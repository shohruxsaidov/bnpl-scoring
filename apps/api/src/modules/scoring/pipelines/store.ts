// ---------------------------------------------------------------------------
// Scoring persistence — the canonical scorings / scoring_pipelines record.
// Leaf module: no KATM/model runtime imports, so flow.ts, poller.ts and the
// wizard endpoints can all write through it without import cycles.
// ---------------------------------------------------------------------------
import { eq } from 'drizzle-orm';
import { db } from '@db';
import { scorings } from '@db/scorings';
import { scoringPipelines } from '@db/scoring-pipelines';
import type { CriteriaScores } from '../criteria-scores';
import type {
  PipelineStatus,
  PipelineSummary,
  PipelineType,
  RejectReasonCode,
  ScoringRejectReasonCode,
} from './types';

export type ScoringRow = typeof scorings.$inferSelect;

/**
 * Create the run for a deal session, or reset it if it already exists
 * (re-run). Called at the top of /start before the myid pipeline.
 */
export async function startScoringRun(dealSessionId: string, userId: number): Promise<ScoringRow> {
  const [row] = await db
    .insert(scorings)
    .values({
      dealSessionId,
      userId,
      status: 'in_progress',
      currentPipeline: 'myid',
    })
    .onConflictDoUpdate({
      target: scorings.dealSessionId,
      set: {
        userId,
        status: 'in_progress',
        currentPipeline: 'myid',
        rejectReasonCode: null,
        katmClaimId: null,
        score: null,
        creditLimit: null,
        criteriaScores: null,
        updatedAt: new Date(),
      },
    })
    .returning();
  if (!row) throw new Error('scoring_upsert_failed');

  // A re-run must drop stale child rows so pipeline history reflects this attempt.
  await db.delete(scoringPipelines).where(eq(scoringPipelines.scoringId, row.id));
  return row;
}

export async function loadScoringBySession(dealSessionId: string): Promise<ScoringRow | null> {
  const [row] = await db
    .select()
    .from(scorings)
    .where(eq(scorings.dealSessionId, dealSessionId))
    .limit(1);
  return row ?? null;
}

export async function setKatmClaimIdOnScoring(scoringId: number, claimId: string): Promise<void> {
  await db
    .update(scorings)
    .set({ katmClaimId: claimId, updatedAt: new Date() })
    .where(eq(scorings.id, scoringId));
}

export async function setCurrentPipeline(
  scoringId: number,
  type: PipelineType | null,
): Promise<void> {
  await db
    .update(scorings)
    .set({ currentPipeline: type, updatedAt: new Date() })
    .where(eq(scorings.id, scoringId));
}

/** Upsert one pipeline row (mutate-in-place on the unique (scoring_id, type)). */
export async function recordPipeline(
  scoringId: number,
  type: PipelineType,
  fields: {
    status: PipelineStatus;
    rejectReasonCode?: RejectReasonCode | null;
    summary?: PipelineSummary | null;
    raw?: unknown;
  },
): Promise<void> {
  const set = {
    status: fields.status,
    rejectReasonCode: fields.rejectReasonCode ?? null,
    summary: (fields.summary ?? null) as unknown as Record<string, unknown> | null,
    raw: (fields.raw ?? null) as Record<string, unknown> | null,
    updatedAt: new Date(),
  };
  await db
    .insert(scoringPipelines)
    .values({ scoringId, type, ...set })
    .onConflictDoUpdate({
      target: [scoringPipelines.scoringId, scoringPipelines.type],
      set,
    });
}

/** Terminal: a pipeline knockout or a model-stage rejection. */
export async function markRejected(
  scoringId: number,
  reasonCode: ScoringRejectReasonCode,
): Promise<void> {
  await db
    .update(scorings)
    .set({
      status: 'rejected',
      currentPipeline: null,
      rejectReasonCode: reasonCode,
      updatedAt: new Date(),
    })
    .where(eq(scorings.id, scoringId));
}

/** All knockout pipelines passed — the model may now run. */
export async function markGatesPassed(scoringId: number): Promise<void> {
  await db
    .update(scorings)
    .set({ status: 'passed', currentPipeline: null, updatedAt: new Date() })
    .where(eq(scorings.id, scoringId));
}

/** Model approved — final outcome stamped on the run. */
export async function markScored(
  scoringId: number,
  result: { score: number; creditLimit: number; criteriaScores: CriteriaScores },
): Promise<void> {
  await db
    .update(scorings)
    .set({
      status: 'scored',
      currentPipeline: null,
      score: result.score,
      creditLimit: result.creditLimit,
      criteriaScores: result.criteriaScores as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(scorings.id, scoringId));
}

/** A vendor/system failure that is neither a clean pass nor a business reject. */
export async function markError(scoringId: number): Promise<void> {
  await db
    .update(scorings)
    .set({ status: 'error', currentPipeline: null, updatedAt: new Date() })
    .where(eq(scorings.id, scoringId));
}
