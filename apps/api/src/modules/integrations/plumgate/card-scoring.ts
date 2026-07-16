// ---------------------------------------------------------------------------
// plum_card — card-behaviour scoring (BullMQ worker logic).
//
// OBSERVATIONAL PIPELINE. It exists to collect Plumgate's card-transaction
// scoring for every scored applicant, persist it, and show it in admin. It does
// NOT feed the model, cannot reject, and — the load-bearing rule —
//
//     it writes its own scoring_pipelines row and NOTHING on `scorings`.
//
// By the time a job lands, /cards/score (or client finalize) has already called
// markScored / markRejected and cleared current_pipeline. A worker that called
// markError() on a vendor timeout would flip an APPROVED run to 'error' while the
// deal is being signed on the other side of the screen. So: no markError, no
// markScored, no setCurrentPipeline. Ever.
//
// Rails differ (see score-card.handler): Uzcard is a two-phase async template
// scoring, Humo answers inline. Both land in one row, discriminated on pcType.
//
// Staleness: an agent can score card A, change their mind, and score card B. Both
// jobs are in flight; either may land first. The row records whose it is
// (summary.cardId), and a job that no longer owns the row DISCARDS its result
// rather than overwriting card B's numbers with card A's — a mislabeled row is
// worse than a missing one, since this data exists to calibrate a future model.
// ---------------------------------------------------------------------------
import type { Queue } from 'bullmq';
import { env } from '../../../env';
import { loadPipeline, recordPipeline } from '../../scoring/pipelines/store';
import type { PipelineStatus, PlumCardSummary } from '../../scoring/pipelines/types';
import { isPipelineEnabled } from '../../scoring/pipelines/settings';
import { plumScoreWindow } from './service/shared';
import {
  createUzcardScoring,
  fetchHumoScore,
  fetchUzcardScore,
  PlumScorePendingError,
  type PlumScoreWindow,
} from './queries/score-card/score-card.handler';

export const PLUM_CARD_SCORE_QUEUE = 'plum-card-score';

export interface PlumCardScoreJobData {
  /** scorings.id — the run the row hangs off. */
  scoringId: number;
  /** Plumgate's My Uzcard card id (NOT the attachment id — see user_cards). */
  plumCardId: string;
  pcType: string;
  maskedPan: string;
}

// The producing Queue is created by the queue plugin and handed here, so the
// merchant wizard and the client finalize path can enqueue without threading the
// queue through every call site. Null until the plugin registers (e.g. in tests):
// enqueue then no-ops, and the scoring run is unaffected — which is the whole
// point of an observational pipeline.
let queueRef: Queue<PlumCardScoreJobData> | null = null;

export function setPlumCardScoreQueue(q: Queue<PlumCardScoreJobData>): void {
  queueRef = q;
}

/**
 * Open the plum_card row as 'pending' and queue the vendor call. Best-effort by
 * construction: every failure path here is swallowed, because nothing about a
 * scoring run may depend on card-behaviour data being collectable.
 *
 * Gated on the ops kill-switch (scoring_pipeline_settings) — flipping plum_card
 * off in the admin panel stops the vendor calls without a deploy.
 */
export async function enqueuePlumCardScore(data: PlumCardScoreJobData): Promise<void> {
  try {
    if (!(await isPipelineEnabled('plum_card'))) return;
    if (!queueRef) return;

    const { beginDate, endDate } = plumScoreWindow(new Date());

    // The pending row is written BEFORE the job is queued: it is what makes the
    // stage visible in admin while the vendor works, and it is what the worker
    // reads to decide whether it still owns the card.
    const summary: PlumCardSummary = {
      pcType: data.pcType,
      cardId: data.plumCardId,
      maskedPan: data.maskedPan,
      periodBegin: beginDate.toISOString(),
      periodEnd: endDate.toISOString(),
    };
    await recordPipeline(data.scoringId, 'plum_card', { status: 'pending', summary, raw: null });

    await queueRef.add('score', data, {
      attempts: env.PLUM_POLL_MAX_ATTEMPTS,
      backoff: { type: 'fixed', delay: env.PLUM_POLL_INTERVAL_MS },
      removeOnComplete: true,
      removeOnFail: 100,
    });
  } catch (err) {
    console.warn('[plum_card] enqueue failed — run unaffected', err);
  }
}

// ---------------------------------------------------------------------------
// Worker body
// ---------------------------------------------------------------------------

/**
 * Re-read the row and confirm this job still owns it. Returns the live summary,
 * or null when the row is gone (run re-started) or the card changed under us.
 */
async function claimRow(data: PlumCardScoreJobData): Promise<PlumCardSummary | null> {
  const row = await loadPipeline(data.scoringId, 'plum_card');
  if (!row) return null;

  const summary = row.summary as PlumCardSummary | null;
  if (!summary || summary.cardId !== data.plumCardId) return null;
  return summary;
}

async function write(
  data: PlumCardScoreJobData,
  status: PipelineStatus,
  summary: PlumCardSummary,
  raw: unknown,
): Promise<void> {
  await recordPipeline(data.scoringId, 'plum_card', { status, summary, raw });
}

function windowOf(summary: PlumCardSummary): PlumScoreWindow {
  return { beginDate: new Date(summary.periodBegin), endDate: new Date(summary.periodEnd) };
}

export async function processPlumCardScoreJob(data: PlumCardScoreJobData): Promise<void> {
  const summary = await claimRow(data);
  if (!summary) return; // stale job — the agent moved to another card, or the run reset

  if (summary.pcType === 'humo') {
    // Synchronous rail: one call, one answer, no vendor scoringId, no polling.
    const result = await fetchHumoScore(data.plumCardId, windowOf(summary));

    // The vendor call is slow enough that the card may have changed under us.
    const still = await claimRow(data);
    if (!still) return;

    await write(
      data,
      'passed',
      {
        ...summary,
        totalDebitScore: result.average?.totalDebitScore,
        totalDebitCount: result.average?.totalDebitCount,
        replenishmentScore: result.average?.replenishmentScore,
        replenishmentCount: result.average?.replenishmentCount,
        creditScore: result.average?.creditScore,
        creditCount: result.average?.creditCount,
      },
      { average: result.average, monthly: result.monthly },
    );
    return;
  }

  // Uzcard, phase 1 — create. The vendor scoringId is persisted onto the row
  // BEFORE the first poll: a retry that re-ran createScoringCard would open (and
  // be billed for) a fresh scoring on every attempt.
  if (summary.plumScoringId == null) {
    const plumScoringId = await createUzcardScoring(data.plumCardId, windowOf(summary));

    const still = await claimRow(data);
    if (!still) return;

    await write(data, 'pending', { ...summary, plumScoringId }, null);
    throw new PlumScorePendingError(); // → BullMQ retry, which lands in phase 2
  }

  // Uzcard, phase 2 — poll. Throws PlumScorePendingError while the vendor is
  // still computing; BullMQ retries until PLUM_POLL_MAX_ATTEMPTS is exhausted.
  const result = await fetchUzcardScore(summary.plumScoringId);

  const still = await claimRow(data);
  if (!still) return;

  await write(
    data,
    'passed',
    {
      ...summary,
      scoredBall: result.scoredBall,
      maxScoreBall: result.maxScoreBall,
      criteria: result.criteria,
    },
    result,
  );
}

/**
 * Attempts exhausted — the vendor never answered. Record it on the row and stop.
 * The scoring run itself is untouched and stays whatever it already was.
 */
export async function handlePlumCardScoreFailure(
  data: PlumCardScoreJobData,
  err: Error,
): Promise<void> {
  const summary = await claimRow(data);
  if (!summary) return;

  await write(data, 'error', summary, { error: err.message });
}
