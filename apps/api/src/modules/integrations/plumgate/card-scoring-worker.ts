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
import type { PlumCardSummary } from '../../scoring/pipelines/types';
import type { ClaimRejectJobData } from '../katm/claim-reject';
import {
  claimPlumRow,
  plumWindowOf,
  writePlumRow,
  type PlumCardScoreJobData,
} from './card-scoring';
import type { PlumHumoScoreRow } from './service/shared';
import {
  createUzcardScoring,
  fetchHumoScore,
  fetchUzcardScore,
  PlumScorePendingError,
  type PlumScoreWindow,
} from './queries/score-card/score-card.handler';
import { finalizeMerchantScoring, loadSessionRow } from '../../merchant/deal-sessions/finalize';
import { stampPlumPending } from '../../merchant/deal-sessions/commands/stamp-plum-pending/stamp-plum-pending.handler';
import { stepDataOf } from '../../merchant/deal-sessions/types';
import { finalizeClientAfterPlum } from '../../client/scoring/finalize';

// ---------------------------------------------------------------------------
// Observation window
//
// Shared by both rails. Neither vendor is told how old the card is, so both would
// otherwise average a young card's turnover across months it did not exist.
// ---------------------------------------------------------------------------

/** Assumed card term. Plum reports only an expiry date, so issuance — and with it
 *  the card's age — is derived by subtracting the standard 5-year term. */
const CARD_TERM_MONTHS = 5 * 12;

/** Whole calendar months from `from` to `to`; never negative. */
function monthsBetween(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return Math.max(months, 0);
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

/**
 * Months since the card was issued, from a "YYMM" expiry — or null when the
 * derivation cannot be trusted.
 *
 * YYMM is the VENDOR's format, which is what every plum_card path carries: the
 * client submits "MM/YY" but `normaliseExpiry` flips it before the card is ever
 * added, and the stored expiry is Plum's own `expireDate` echoed back.
 *
 * Null is returned for a missing or unparseable expiry, an already-expired card,
 * and an expiry further out than the assumed term (which means the card was NOT
 * issued on a 5-year term, so the subtraction says nothing). Callers treat null
 * as "assume the card is at least as old as the window" — the conservative
 * reading, since a too-long window can only ever understate turnover.
 */
export function cardAgeMonths(expiry: string, now: Date): number | null {
  // Expecting "YYMM", e.g. "3006" ⇒ June 2030.
  if (!/^\d{4}$/.test(expiry)) return null;

  const year = 2000 + Number(expiry.slice(0, 2));
  const month = Number(expiry.slice(2));
  if (month < 1 || month > 12) return null;

  const expiryIndex = year * 12 + month;
  const currentIndex = now.getFullYear() * 12 + (now.getMonth() + 1);
  const age = currentIndex - (expiryIndex - CARD_TERM_MONTHS);

  if (age < 0 || age > CARD_TERM_MONTHS) return null;
  return age;
}

/**
 * The window a card is actually measurable over: the standard window, clipped to
 * the card's own lifetime.
 *
 * A card issued four months ago has no history before that, and averaging its
 * turnover across the full 12 months would understate it threefold — on BOTH
 * rails, since uzcard's "средняя ежемесячная" criteria are averaged by the vendor
 * over whatever window the scoring was created with. This only ever NARROWS: a
 * card older than the window keeps the full window, so mature cards stay
 * comparable to each other.
 *
 * Whatever this returns must be stamped onto the summary by the caller. The band
 * and the period it covers are meaningless apart.
 */
export function scoreWindowOf(
  summary: PlumCardSummary,
  expiry: string,
  now: Date,
): PlumScoreWindow {
  const full = plumWindowOf(summary);
  const age = cardAgeMonths(expiry, now);
  if (age == null) return full;

  const beginDate = addMonths(full.endDate, -age);
  return beginDate > full.beginDate ? { beginDate, endDate: full.endDate } : full;
}

// ---------------------------------------------------------------------------
// Turnover bands
//
// NEITHER rail reports a turnover figure. Both report a bucket index, so the only
// honest reading of either is a BAND, and the two scales are unrelated (see
// service/shared.ts). Everything below converts a bucket index to som; nothing
// below ever narrows a band to a point.
// ---------------------------------------------------------------------------

// --- humo ------------------------------------------------------------------

/** Humo bucket width: ball N ⇒ that month's turnover was in ((N-1)m, N*1m] som. */
const HUMO_BUCKET_SOM = 1_000_000;

/** Sums one month-series of balls into a som band. Ball 0 is a real zero — no
 *  turnover — not bucket "up to 1m", so it contributes nothing to either bound. */
function sumBallBand(balls: number[]): { min: number; max: number } {
  let min = 0;
  let max = 0;
  for (const raw of balls) {
    const ball = Math.max(Math.floor(raw), 0);
    if (ball === 0) continue;
    min += (ball - 1) * HUMO_BUCKET_SOM;
    max += ball * HUMO_BUCKET_SOM;
  }
  return { min, max };
}

export interface HumoTurnoverBand {
  minAvgAmount: number;
  maxAvgAmount: number;
  turnoverBasis?: 'replenishment' | 'debit';
}

/**
 * Monthly average turnover band, in som, across the observation window.
 *
 * Each month's bucket contributes its own ((N-1)m, N*1m] bracket, so the average
 * carries a true 1 млн-wide band. The previous floor/ceil of the summed balls
 * collapsed to a point figure whenever the sum divided evenly — a precision the
 * vendor never reported.
 *
 * `monthCount` is the window, not the number of reported rows: a month the vendor
 * omitted is a month with no turnover, and dividing by the rows alone would
 * average away every idle month and overstate the card.
 *
 * Replenishment (money in) is preferred; total debit is a fallback for a card
 * that reports no inflow at all, and the choice is stamped on the summary because
 * spending must not be read as income.
 */
export function humoTurnoverBandOf(
  rows: PlumHumoScoreRow[],
  monthCount: number,
): HumoTurnoverBand {
  // Never fewer months than we hold data for, and never zero.
  const months = Math.max(monthCount, rows.length, 1);

  const replenishment = sumBallBand(rows.map((row) => row.replenishmentScore ?? 0));
  if (replenishment.max > 0) {
    return {
      minAvgAmount: Math.round(replenishment.min / months),
      maxAvgAmount: Math.round(replenishment.max / months),
      turnoverBasis: 'replenishment',
    };
  }

  const debit = sumBallBand(rows.map((row) => row.totalDebitScore ?? 0));
  if (debit.max > 0) {
    return {
      minAvgAmount: Math.round(debit.min / months),
      maxAvgAmount: Math.round(debit.max / months),
      turnoverBasis: 'debit',
    };
  }

  // Neither series moved: a genuine zero, and no basis to record.
  return { minAvgAmount: 0, maxAvgAmount: 0 };
}

// --- uzcard ----------------------------------------------------------------

// Uzcard grades turnover into coarse buckets and reports only the bucket index
// (`ball`), so a BAND is the honest reading — never a point figure. Steps are
// 1 млн up to ball 12, then widen; the top bucket is open-ended and carries no
// ceiling (max stays null). Amounts are in som.
//
// The bucket is whatever its CRITERION measures — some criteria are a total over
// the scoring window, others are already a monthly average. The scale itself says
// nothing about which; see turnoverBandOf.
const BALL_TURNOVER_BANDS: Array<{ min: number; max: number | null }> = [
  { min: 0, max: 0 }, // 0
  { min: 1, max: 1_000_000 }, // 1
  { min: 1_000_000, max: 1_500_000 }, // 2
  { min: 1_500_000, max: 2_000_000 }, // 3
  { min: 2_000_000, max: 2_500_000 }, // 4
  { min: 2_500_000, max: 3_000_000 }, // 5
  { min: 3_000_000, max: 4_000_000 }, // 6
  { min: 4_000_000, max: 5_000_000 }, // 7
  { min: 5_000_000, max: 6_000_000 }, // 8
  { min: 6_000_000, max: 7_000_000 }, // 9
  { min: 7_000_000, max: 8_000_000 }, // 10
  { min: 8_000_000, max: 9_000_000 }, // 11
  { min: 9_000_000, max: 10_000_000 }, // 12
  { min: 10_000_000, max: 12_000_000 }, // 13
  { min: 12_000_000, max: 15_000_000 }, // 14
  { min: 15_000_000, max: 20_000_000 }, // 15
  { min: 20_000_000, max: 25_000_000 }, // 16
  { min: 25_000_000, max: 30_000_000 }, // 17
  { min: 30_000_000, max: 35_000_000 }, // 18
  { min: 35_000_000, max: 40_000_000 }, // 19
  { min: 40_000_000, max: 45_000_000 }, // 20
  { min: 45_000_000, max: 50_000_000 }, // 21
  { min: 50_000_000, max: 55_000_000 }, // 22
  { min: 55_000_000, max: 60_000_000 }, // 23
  { min: 60_000_000, max: 65_000_000 }, // 24
  { min: 65_000_000, max: 70_000_000 }, // 25
  { min: 70_000_000, max: 75_000_000 }, // 26
  { min: 75_000_000, max: 80_000_000 }, // 27
  { min: 80_000_000, max: 85_000_000 }, // 28
  { min: 85_000_000, max: 90_000_000 }, // 29
  { min: 90_000_000, max: null }, // 30 — 90 млн +
];

/**
 * Ball → its raw bucket, in som. A ball outside the table is clamped rather than
 * rejected: the vendor owns the scale and may extend it, and a turnover figure is
 * not worth failing a run over. A fractional ball floors to its bucket, so the
 * band still contains the real figure.
 */
function ballBucketOf(ball: number): { min: number; max: number | null } {
  const index = Math.min(Math.max(Math.floor(ball), 0), BALL_TURNOVER_BANDS.length - 1);
  return BALL_TURNOVER_BANDS[index];
}

/**
 * Monthly average turnover band, in som, for an uzcard run.
 *
 * The two criteria are NOT the same measurement, and that is the whole reason
 * this is not one subtraction:
 *   inflow — "Сумма ВСЕХ поступлений..." is a TOTAL over the scoring window, so
 *            it is divided by the window's months to become a monthly average.
 *   atm    — "СРЕДНЯЯ ЕЖЕМЕСЯЧНАЯ сумма пополнения с банкомата..." is ALREADY a
 *            monthly average, so it must not be divided again.
 * They are also subtracted in SOM, never in ball space: the scale is non-linear
 * (1 млн steps low down, 5 млн steps high up), so a difference of bucket indices
 * does not correspond to any difference of amounts.
 *
 * The subtraction is band-correct — the smallest net pairs the smallest inflow
 * with the largest ATM figure, and vice versa — so the result still brackets the
 * true value rather than pretending to a precision the buckets never had.
 */
export function turnoverBandOf(
  inflowBall: number,
  atmBall: number,
  monthCount: number,
): { minAvgAmount: number; maxAvgAmount?: number } {
  const months = Math.max(monthCount, 1);
  const inflow = ballBucketOf(inflowBall);
  const atm = ballBucketOf(atmBall);

  // An open-ended ATM bucket means the deduction has no known ceiling, so the
  // net has no known floor — 0 is the only honest lower bound.
  const minAvgAmount = Math.max(Math.round(inflow.min / months - (atm.max ?? Infinity)), 0);

  // An open-ended inflow bucket leaves the net open-ended above.
  if (inflow.max == null) return { minAvgAmount };

  const maxAvgAmount = Math.max(Math.round(inflow.max / months - atm.min), minAvgAmount);
  return { minAvgAmount, maxAvgAmount };
}

export async function processPlumCardScoreJob(
  data: PlumCardScoreJobData,
  rejectQueue: Queue<ClaimRejectJobData>,
): Promise<void> {
  const summary = await claimPlumRow(data);
  // Stale job — the agent moved to another card, or the run was re-opened. The
  // successor job drives the run; writing here would mislabel its row.
  if (!summary) return;

  if (summary.pcType === 1) {
    // Synchronous rail: one call, one answer, no vendor scoringId, no polling.
    //
    // The window is clipped to the card's own lifetime before the call — asking
    // for months the card did not exist buys nothing, and averaging over them
    // would understate a young card. The window actually used is stamped back
    // onto the row, so the band and the period it covers can never disagree.
    const window = scoreWindowOf(summary, data.expiry, new Date());
    const result = await fetchHumoScore(data.cardId, window, data.expiry);

    // The vendor call is slow enough that the card may have changed under us.
    if (!(await claimPlumRow(data))) return;

    await writePlumRow(
      data,
      'passed',
      {
        ...summary,
        periodBegin: window.beginDate.toISOString(),
        periodEnd: window.endDate.toISOString(),
        ...humoTurnoverBandOf(result.monthly, monthsBetween(window.beginDate, window.endDate)),
      },
      { monthly: result.monthly },
    );
    await advanceToModel(data.scoringId, rejectQueue);
    return;
  }

  // Uzcard, phase 1 — create. The vendor scoringId is persisted onto the row
  // BEFORE the first poll: a retry that re-ran createScoringCard would open (and
  // be billed for) a fresh scoring on every attempt.
  //
  // The window is clipped to the card's lifetime here and NOWHERE ELSE: the
  // vendor computes the template against the window it was created with, so this
  // is the only moment it can be chosen. It is persisted alongside plumScoringId
  // for the same reason — phase 2 must report the period the vendor actually
  // scored, not one recomputed from a later `now`.
  if (summary.plumScoringId == null) {
    const window = scoreWindowOf(summary, data.expiry, new Date());
    const plumScoringId = await createUzcardScoring(data.cardId, window);

    if (!(await claimPlumRow(data))) return;

    await writePlumRow(
      data,
      'pending',
      {
        ...summary,
        plumScoringId,
        periodBegin: window.beginDate.toISOString(),
        periodEnd: window.endDate.toISOString(),
      },
      null,
    );
    throw new PlumScorePendingError(); // → BullMQ retry, which lands in phase 2
  }

  // Uzcard, phase 2 — poll. Throws PlumScorePendingError while the vendor is
  // still computing; BullMQ retries until PLUM_POLL_MAX_ATTEMPTS is exhausted.
  const result = await fetchUzcardScore(summary.plumScoringId);

  // Non-P2P inflow MINUS the ATM top-up part of it: cash the holder loaded onto
  // their own card is not turnover we want to read as income.
  const inflowBall = result.criteria.find((item) => {
    return item.name === 'Сумма всех поступлений не являющихся P2P транзакциями на карту';
  });

  const atmBall = result.criteria.find((item) => {
    return item.name === 'Средняя ежемесячная сумма пополнения с банкомата на карты';
  });

  // The window PERSISTED IN PHASE 1 — the one the vendor actually scored against
  // — not one recomputed from today. Re-deriving it here could divide the
  // vendor's total by a different number of months than it was measured over.
  const window = plumWindowOf(summary);

  if (!(await claimPlumRow(data))) return;

  await writePlumRow(
    data,
    'passed',
    {
      ...summary,
      scoredBall: result.scoredBall,
      maxScoreBall: result.maxScoreBall,
      criteria: result.criteria,
      ...turnoverBandOf(
        inflowBall?.ball ?? 0,
        atmBall?.ball ?? 0,
        monthsBetween(window.beginDate, window.endDate),
      ),
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
