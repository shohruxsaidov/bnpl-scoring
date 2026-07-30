// ---------------------------------------------------------------------------
// plum_card — card-behaviour scoring. Enqueue side + row helpers.
//
// BLOCKING PRE-MODEL PIPELINE. The card score feeds the model, so the model may
// not run until Plum has answered. That inverts the rule this file used to hold:
// it no longer merely writes its own scoring_pipelines row, it now advances the
// run itself (see card-scoring-worker.ts, which owns every write to `scorings`).
//
// A Plum failure therefore HARD-BLOCKS: scoring against a model input the engine
// would silently read as 0 understates the score and produces false rejects. See
// the mutilated-input-vector rule in scoring/pipelines/config.ts.
//
// Rails differ (see score-card.handler): Uzcard is a two-phase async template
// scoring, Humo answers inline. Both go through the queue regardless — even the
// "synchronous" rail is two vendor calls at a 15s timeout, which does not belong
// inside an HTTP handler. Both land in one row, discriminated on pcType.
//
// This module stays a LEAF (store + vendor handlers only): the enqueue sites are
// the merchant wizard and the client scoring path, and the worker imports both of
// their finalizers, so any finalizer import here would close a cycle.
// ---------------------------------------------------------------------------
import type { Queue } from 'bullmq';
import { env } from '../../../env';
import { loadPipeline, loadRecentPlumResult, recordPipeline } from '../../scoring/pipelines/store';
import type { PipelineStatus, PlumCardSummary } from '../../scoring/pipelines/types';
import { isPipelineEnabled } from '../../scoring/pipelines/settings';
import { plumScoreWindow } from './service/shared';
import type { PlumScoreWindow } from './queries/score-card/score-card.handler';

export const PLUM_CARD_SCORE_QUEUE = 'plum-card-score';

/**
 * How long a card's scoring stays reusable. Plum bills per scoring, so a same-day
 * retry, card switch or wizard re-run must not buy the same figures twice.
 *
 * Deliberately short: at 24h this only collapses the duplicates a single sitting
 * produces, which keeps every run's card data as of the day it was scored and
 * avoids having to reason about a card whose behaviour moved under a stale row.
 */
export const PLUM_RESULT_TTL_MS = 24 * 60 * 60 * 1000;

export interface PlumCardScoreJobData {
  /** scorings.id — the run the row hangs off. */
  scoringId: number;
  /** Plumgate's My Uzcard card id (NOT the attachment id — see user_cards). */
  plumCardId: string;
  pcType: string;
  maskedPan: string;
}

/**
 * What the enqueue did, so the caller knows whether to wait.
 *   skipped — the ops kill-switch is off; there is no plum stage on this run
 *   ready   — a recent scoring of this card was reused; the stage is already done
 *   queued  — the vendor is working; the run must wait for the worker
 * Only 'queued' means the caller should answer 'pending'; the other two mean the
 * model can run immediately.
 */
export type PlumStageOutcome = 'skipped' | 'ready' | 'queued';

/** Thrown when the queue plugin never registered. Blocking stage ⇒ never silent. */
export class PlumQueueUnavailableError extends Error {
  constructor() {
    super('plum_queue_unavailable');
    this.name = 'PlumQueueUnavailableError';
  }
}

// The producing Queue is created by the queue plugin and handed here, so the
// merchant wizard and the client scoring path can enqueue without threading the
// queue through every call site.
let queueRef: Queue<PlumCardScoreJobData> | null = null;

export function setPlumCardScoreQueue(q: Queue<PlumCardScoreJobData>): void {
  queueRef = q;
}

/** One job per run. Lets a double-POST dedupe instead of opening (and being
 *  billed for) a second vendor scoring. */
export function plumJobId(scoringId: number): string {
  return `plum_${scoringId}`;
}

/**
 * Open the plum_card stage: reuse a recent result if there is one, otherwise
 * write the 'pending' row and queue the vendor call.
 *
 * NOTHING here is swallowed any more. This stage gates the model, so a failure to
 * even start it must reach the caller, which marks the run 'error' rather than
 * scoring against card params the engine would read as 0.
 */
export async function enqueuePlumCardScore(data: PlumCardScoreJobData): Promise<PlumStageOutcome> {
  // Ops kill-switch. Off ⇒ there is no plum stage at all: no vendor call, no row,
  // no wait, and the caller finalizes inline. Once card params exist, the model
  // editor's existing rule (config.ts) is what stops a model that needs them from
  // running while this is off.
  if (!(await isPipelineEnabled('plum_card'))) return 'skipped';

  // Cache hit — copy the earlier scoring forward rather than buying it again. The
  // copy keeps the ORIGINAL observation window and records where it came from, so
  // admin can see the figures are as of then, not now.
  const cached = await loadRecentPlumResult(data.plumCardId, PLUM_RESULT_TTL_MS);
  if (cached) {
    const summary = cached.summary as PlumCardSummary;
    await recordPipeline(data.scoringId, 'plum_card', {
      status: 'passed',
      summary: { ...summary, reusedFromScoringId: cached.scoringId },
      raw: cached.raw,
    });
    return 'ready';
  }

  if (!queueRef) throw new PlumQueueUnavailableError();

  const existing = await loadPipeline(data.scoringId, 'plum_card');
  const prior = existing?.summary as PlumCardSummary | null;
  const sameCard = prior?.cardId === data.plumCardId;

  // A job for this same card is already in flight (the agent double-tapped, or
  // re-POSTed while Plum was working). Rewriting the row would discard the vendor
  // scoringId the worker persisted onto it, and the next attempt would open — and
  // be billed for — a second scoring of the same card.
  if (existing?.status === 'pending' && sameCard) return 'queued';

  const { beginDate, endDate } = plumScoreWindow(new Date());

  // The pending row is written BEFORE the job is queued: it is what makes the
  // stage visible while the vendor works, and it is what the worker reads to
  // decide whether it still owns the card.
  const summary: PlumCardSummary = {
    pcType: data.pcType,
    cardId: data.plumCardId,
    maskedPan: data.maskedPan,
    periodBegin: beginDate.toISOString(),
    periodEnd: endDate.toISOString(),
    // Carry a scoring the vendor already opened for this card into the retry, so
    // re-driving a stage that timed out RESUMES the poll instead of buying a
    // second scoring. Dropped when the card changed — that id belongs to the
    // other card, and its window with it.
    ...(sameCard && prior?.plumScoringId != null
      ? {
          plumScoringId: prior.plumScoringId,
          periodBegin: prior.periodBegin,
          periodEnd: prior.periodEnd,
        }
      : {}),
  };
  await recordPipeline(data.scoringId, 'plum_card', { status: 'pending', summary, raw: null });

  await queueRef.add('score', data, {
    jobId: plumJobId(data.scoringId),
    attempts: env.PLUM_POLL_MAX_ATTEMPTS,
    backoff: { type: 'fixed', delay: env.PLUM_POLL_INTERVAL_MS },
    removeOnComplete: true,
    // Removed on failure so a retry can re-add the same jobId. The failure is
    // recorded durably on the scoring_pipelines row and on `scorings` — a better
    // record than a stranded entry in Redis's failed set, which would silently
    // block every subsequent retry of this run.
    removeOnFail: true,
  });
  return 'queued';
}

// ---------------------------------------------------------------------------
// Row helpers — shared with the worker
// ---------------------------------------------------------------------------

/**
 * Re-read the row and confirm the job still owns it. Returns the live summary, or
 * null when the row is gone (run re-started) or the card changed under us.
 *
 * A job that no longer owns the row discards its result rather than overwriting
 * the current card's numbers with a previous card's — a mislabeled row is worse
 * than a missing one. Discarding is safe even though the stage now blocks,
 * because every way of losing ownership creates a successor that drives the run:
 * a re-opened stage always enqueues its own job.
 */
export async function claimPlumRow(data: PlumCardScoreJobData): Promise<PlumCardSummary | null> {
  const row = await loadPipeline(data.scoringId, 'plum_card');
  if (!row) return null;

  const summary = row.summary as PlumCardSummary | null;
  if (!summary || summary.cardId !== data.plumCardId) return null;
  return summary;
}

export async function writePlumRow(
  data: PlumCardScoreJobData,
  status: PipelineStatus,
  summary: PlumCardSummary,
  raw: unknown,
): Promise<void> {
  await recordPipeline(data.scoringId, 'plum_card', { status, summary, raw });
}

export function plumWindowOf(summary: PlumCardSummary): PlumScoreWindow {
  return { beginDate: new Date(summary.periodBegin), endDate: new Date(summary.periodEnd) };
}
