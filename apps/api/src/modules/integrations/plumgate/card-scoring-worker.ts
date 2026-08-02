// ---------------------------------------------------------------------------
// plum_card — BullMQ worker body.
//
// Split from card-scoring.ts because this half advances the RUN: when Plum
// answers it claims the model stage and finalizes, and when Plum never answers it
// fails the run. That means importing both origins' finalizers, so the module is
// imported only by plugins/queue.ts — nothing the finalizers themselves reach.
//
// Uzcard is two-phase: create (persisting the vendor scoringId before the first
// poll, or every retry re-creates and re-bills a scoring) then poll. Humo answers
// inline. Both land in one row, discriminated on pcType.
// ---------------------------------------------------------------------------
import type { Queue } from 'bullmq';
import { claimModelStage, loadScoringById, markError } from '../../scoring/pipelines/store';
import type { ClaimRejectJobData } from '../katm/claim-reject';
import {
  claimPlumRow,
  plumWindowOf,
  writePlumRow,
  type PlumCardScoreJobData,
} from './card-scoring';
import {
  createUzcardScoring,
  fetchHumoScore,
  fetchUzcardScore,
  PlumScorePendingError,
} from './queries/score-card/score-card.handler';
import { finalizeMerchantScoring, loadSessionRow } from '../../merchant/deal-sessions/finalize';
import { stampPlumPending } from '../../merchant/deal-sessions/commands/stamp-plum-pending/stamp-plum-pending.handler';
import { stepDataOf } from '../../merchant/deal-sessions/types';
import { finalizeClientAfterPlum } from '../../client/scoring/finalize';

export async function processPlumCardScoreJob(
  data: PlumCardScoreJobData,
  rejectQueue: Queue<ClaimRejectJobData>,
): Promise<void> {
  const summary = await claimPlumRow(data);
  // Stale job — the agent moved to another card, or the run was re-opened. The
  // successor job drives the run; writing here would mislabel its row.
  if (!summary) return;

  if (summary.pcType === 'humo') {
    // Synchronous rail: one call, one answer, no vendor scoringId, no polling.
    const result = await fetchHumoScore(data.cardId, plumWindowOf(summary));

    // The vendor call is slow enough that the card may have changed under us.
    if (!(await claimPlumRow(data))) return;

    await writePlumRow(
      data,
      'passed',
      {
        ...summary,
      },
      { monthly: result.monthly },
    );
    await advanceToModel(data.scoringId, rejectQueue);
    return;
  }

  // Uzcard, phase 1 — create. The vendor scoringId is persisted onto the row
  // BEFORE the first poll: a retry that re-ran createScoringCard would open (and
  // be billed for) a fresh scoring on every attempt.
  if (summary.plumScoringId == null) {
    const plumScoringId = await createUzcardScoring(data.plumCardId, plumWindowOf(summary));

    if (!(await claimPlumRow(data))) return;

    await writePlumRow(data, 'pending', { ...summary, plumScoringId }, null);
    throw new PlumScorePendingError(); // → BullMQ retry, which lands in phase 2
  }

  // Uzcard, phase 2 — poll. Throws PlumScorePendingError while the vendor is
  // still computing; BullMQ retries until PLUM_POLL_MAX_ATTEMPTS is exhausted.
  const result = await fetchUzcardScore(summary.plumScoringId);

  if (!(await claimPlumRow(data))) return;

  await writePlumRow(
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
  await advanceToModel(data.scoringId, rejectQueue);
}

/**
 * Plum has answered — run the model, if we win the claim.
 *
 * The polling GET races us on purpose (it is the fallback that stops a dead
 * worker stalling a wizard forever), so a null claim is the normal, correct
 * outcome of losing that race, not an error.
 */
async function advanceToModel(
  scoringId: number,
  rejectQueue: Queue<ClaimRejectJobData>,
): Promise<void> {
  const run = await claimModelStage(scoringId);
  if (!run) return;

  if (run.origin === 'client') {
    await finalizeClientAfterPlum(run);
    return;
  }
  if (!run.dealSessionId) return;
  const session = await loadSessionRow(run.dealSessionId);
  if (!session) return;
  await finalizeMerchantScoring(session, run, rejectQueue);
}

/**
 * Attempts exhausted — Plum never answered. The card score feeds the model, so
 * this HARD-BLOCKS: the run fails rather than being scored against an input the
 * engine would silently read as 0.
 *
 * A technical timeout is retryable, so no rejection is recorded and (on the
 * client path) no 0-limit cooldown is written — the applicant may re-drive the
 * plum stage alone, reusing the bureau reports already paid for.
 */
export async function handlePlumCardScoreFailure(
  data: PlumCardScoreJobData,
  err: Error,
): Promise<void> {
  const summary = await claimPlumRow(data);
  if (summary) {
    await writePlumRow(data, 'error', summary, { error: err.message });
  }

  const run = await loadScoringById(data.scoringId);
  // Only fail a run still parked on this stage. One that has moved on (the GET
  // finalized it, or the agent re-scored another card) is not ours to break.
  if (!run || run.currentPipeline !== 'plum_card') return;

  await markError(data.scoringId);

  if (run.origin !== 'client' && run.dealSessionId) {
    const session = await loadSessionRow(run.dealSessionId);
    const pending = session ? stepDataOf(session).plumPending : null;
    if (session && pending) {
      await stampPlumPending(session, {
        ...pending,
        status: 'failed',
        error: err instanceof PlumScorePendingError ? 'plum_score_timeout' : err.message,
      });
    }
  }
}
