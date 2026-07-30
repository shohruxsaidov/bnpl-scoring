// ---------------------------------------------------------------------------
// Scoring persistence — the canonical scorings / scoring_pipelines record.
// Leaf module: no KATM/model runtime imports, so flow.ts, poller.ts and the
// wizard endpoints can all write through it without import cycles.
// ---------------------------------------------------------------------------
import { and, desc, eq, gt, sql } from 'drizzle-orm';
import { db } from '@db';
import { scorings } from '@db/scorings';
import { scoringPipelines } from '@db/scoring-pipelines';
import { dealSessions } from '@db/deal-sessions';
import { recordAction } from '../../client/actions/service';
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

export async function loadScoringById(id: number): Promise<ScoringRow | null> {
  const [row] = await db.select().from(scorings).where(eq(scorings.id, id)).limit(1);
  return row ?? null;
}

/**
 * Open a client self-scoring run (Client Scoring). No deal_session — anchored on
 * the user. The partial unique index scorings_client_inflight_idx makes a second
 * in-flight run for the same user fail here (23505); the caller maps that to a
 * "already in progress" response. Throws on any other insert failure.
 */
export async function startClientScoringRun(userId: number): Promise<ScoringRow> {
  const [row] = await db
    .insert(scorings)
    .values({
      dealSessionId: null,
      userId,
      origin: 'client',
      status: 'in_progress',
      currentPipeline: 'myid',
    })
    .returning();
  if (!row) throw new Error('client_scoring_insert_failed');
  return row;
}

/** The user's most recent client run, or null. */
export async function loadLatestClientScoring(userId: number): Promise<ScoringRow | null> {
  const [row] = await db
    .select()
    .from(scorings)
    .where(and(eq(scorings.userId, userId), eq(scorings.origin, 'client')))
    .orderBy(desc(scorings.id))
    .limit(1);
  return row ?? null;
}

/**
 * The user's client run awaiting the model stage: KATM gates cleared
 * (status 'passed') but the numeric model has not run yet. Null when none —
 * i.e. nothing to finalize.
 */
export async function loadClientScoringAwaitingModel(userId: number): Promise<ScoringRow | null> {
  const [row] = await db
    .select()
    .from(scorings)
    .where(
      and(
        eq(scorings.userId, userId),
        eq(scorings.origin, 'client'),
        eq(scorings.status, 'passed'),
      ),
    )
    .orderBy(desc(scorings.id))
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

/** One pipeline row of a run, or null. */
export async function loadPipeline(
  scoringId: number,
  type: PipelineType,
): Promise<typeof scoringPipelines.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(scoringPipelines)
    .where(and(eq(scoringPipelines.scoringId, scoringId), eq(scoringPipelines.type, type)))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// plum_card staging — the blocking pre-model stage
// ---------------------------------------------------------------------------

/**
 * Open (or re-open) the plum_card stage on a run whose knockout gates have all
 * passed. `currentPipeline` is the token the model stage is claimed with, so
 * setting it here is what gives claimModelStage() something to win.
 *
 * Deliberately legal from 'error' too: a Plum timeout is a technical failure and
 * its retry re-opens THIS run rather than starting a fresh one — the chargeable
 * 077/INPS reports are already stored under the run's claimId and must not be
 * bought a second time because a vendor was slow.
 */
export async function openPlumStage(scoringId: number): Promise<void> {
  await db
    .update(scorings)
    .set({ status: 'passed', currentPipeline: 'plum_card', updatedAt: new Date() })
    .where(eq(scorings.id, scoringId));
}

/**
 * Compare-and-swap the run out of the plum stage and into the model stage.
 * Returns the row to exactly ONE caller; every other caller gets null.
 *
 * Two triggers race for the model by design: the BullMQ worker fires the moment
 * Plum answers, and the polling GET fires as the fallback that stops a dead
 * worker from stalling a wizard forever. Without this swap both would run the
 * model — and on the merchant reject path both would close the session and
 * enqueue a second claim retraction.
 */
export async function claimModelStage(scoringId: number): Promise<ScoringRow | null> {
  const [row] = await db
    .update(scorings)
    .set({ currentPipeline: 'model_score', updatedAt: new Date() })
    .where(and(eq(scorings.id, scoringId), eq(scorings.currentPipeline, 'plum_card')))
    .returning();
  return row ?? null;
}

/**
 * The most recent successful plum_card result for a card, no older than maxAgeMs.
 *
 * Plum bills per scoring, so a card must not be re-scored for every retry, card
 * switch or wizard re-run. The observation window is rolling (now−N → now) and so
 * can never be part of the key: the key is the card alone, and a hit carries its
 * own older periodBegin/periodEnd — which is why the copy is stamped with
 * reusedFromScoringId instead of being passed off as fresh.
 */
export async function loadRecentPlumResult(
  plumCardId: string,
  maxAgeMs: number,
): Promise<typeof scoringPipelines.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(scoringPipelines)
    .where(
      and(
        eq(scoringPipelines.type, 'plum_card'),
        eq(scoringPipelines.status, 'passed'),
        gt(scoringPipelines.updatedAt, new Date(Date.now() - maxAgeMs)),
        sql`${scoringPipelines.summary} ->> 'cardId' = ${plumCardId}`,
      ),
    )
    .orderBy(desc(scoringPipelines.updatedAt))
    .limit(1);
  return row ?? null;
}

/**
 * Write the client-actions row for a run that has just reached a terminal state.
 *
 * Only the VERDICT is recorded, never the kickoff: a run that opens and resolves
 * is one thing the client did, and logging both would double every scoring in the
 * admin tab. Keyed on the run id, so a retrying KATM poller that re-marks the same
 * run cannot write a second row.
 *
 * Merchant runs are attributed to the Agent who drove the wizard, which costs one
 * lookup per terminal transition — once per run, not per pipeline.
 */
async function recordScoringOutcome(
  row: ScoringRow | undefined,
  status: 'success' | 'failed',
  reasonCode: string | null,
): Promise<void> {
  if (!row?.userId) return;

  let actorType: 'client' | 'agent' = row.origin === 'client' ? 'client' : 'agent';
  let actorId: number | null = null;
  let merchantId: number | null = null;

  if (actorType === 'agent' && row.dealSessionId) {
    const [session] = await db
      .select({ agentId: dealSessions.agentId, merchantId: dealSessions.merchantId })
      .from(dealSessions)
      .where(eq(dealSessions.id, row.dealSessionId))
      .limit(1);
    actorId = session?.agentId ?? null;
    merchantId = session?.merchantId ?? null;
  }

  await recordAction({
    userId: row.userId,
    action: 'scoring',
    status,
    reasonCode,
    actorType,
    actorId,
    merchantId,
    scoringId: row.id,
    dealSessionId: row.dealSessionId,
    dedupeKey: `scoring:${row.id}`,
  });
}

/** Terminal: a pipeline knockout or a model-stage rejection. */
export async function markRejected(
  scoringId: number,
  reasonCode: ScoringRejectReasonCode,
): Promise<void> {
  const [row] = await db
    .update(scorings)
    .set({
      status: 'rejected',
      currentPipeline: null,
      rejectReasonCode: reasonCode,
      updatedAt: new Date(),
    })
    .where(eq(scorings.id, scoringId))
    .returning();
  await recordScoringOutcome(row, 'failed', reasonCode);
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
  result: { score: number; creditLimit: string; criteriaScores: CriteriaScores },
): Promise<void> {
  const [row] = await db
    .update(scorings)
    .set({
      status: 'scored',
      currentPipeline: null,
      score: result.score,
      creditLimit: result.creditLimit,
      criteriaScores: result.criteriaScores as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(scorings.id, scoringId))
    .returning();
  await recordScoringOutcome(row, 'success', null);
}

/** A vendor/system failure that is neither a clean pass nor a business reject. */
export async function markError(scoringId: number): Promise<void> {
  const [row] = await db
    .update(scorings)
    .set({ status: 'error', currentPipeline: null, updatedAt: new Date() })
    .where(eq(scorings.id, scoringId))
    .returning();
  // 'scoring_error' rather than a null reason: the tab must distinguish "the
  // bureau said no" from "the bureau did not answer" — only one is the client's.
  await recordScoringOutcome(row, 'failed', 'scoring_error');
}
