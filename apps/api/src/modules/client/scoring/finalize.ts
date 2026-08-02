import { desc, eq } from 'drizzle-orm';
import { db } from '@db';
import { userCards } from '@db/user-cards';
import { userCreditLimits } from '@db/user-credit-limits';
import { katm077Reports } from '@db/katm-077-reports';
import { katmInpsReports } from '@db/katm-inps-reports';
import { users } from '@db/users';
import { resolveScoringModel } from '../../scoring/resolve-model';
import { runModelAndLimit, type LimitCard } from '../../scoring/compute-limit';
import { loadBlockingDeal } from '../../deals/blocking';
import { isRetryableRejectReason } from '../../scoring/pipelines/types';
import {
  claimModelStage,
  loadClientScoringAwaitingModel,
  loadPipeline,
  markError,
  markRejected,
  markScored,
  openPlumStage,
  recordPipeline,
  setCurrentPipeline,
  type ScoringRow,
} from '../../scoring/pipelines/store';
import type { PipelineStepResult } from '../../integrations/katm/flow';
import {
  enqueuePlumCardScore,
  loadPlumTurnoverFloor,
} from '../../integrations/plumgate/card-scoring';
import { notify } from '../notifications/service';

/** Credit-limit validity window before a re-score is allowed (Q: 7 days). */
export const CLIENT_LIMIT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Terminal/next-step outcome of a client run, returned to the caller (the
 * /start handler maps it to an HTTP response; the poller maps 'enqueue' to a
 * follow-up poll). Side effects (limit write, model run) already happened.
 */
export type ClientStepOutcome =
  | { status: 'pending'; enqueue?: { reportType: '077' | 'inps' | 'mib'; token: string } }
  | { status: 'awaiting_card' }
  | { status: 'rejected'; reasonCode: string; missingFields?: string[] }
  | { status: 'failed'; reason: string }
  | { status: 'scored'; creditLimit: string }
  | { status: 'error' };

/** Upsert the user's current credit limit (whole som string; '0' on rejection). */
export async function writeClientCreditLimit(
  userId: number,
  scoringId: number,
  creditLimit: string,
): Promise<{ creditLimit: string; expiresAt: Date }> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + CLIENT_LIMIT_TTL_MS);
  await db
    .insert(userCreditLimits)
    .values({ userId, creditLimit, scoringId, scoredAt: now, expiresAt })
    .onConflictDoUpdate({
      target: userCreditLimits.userId,
      set: { creditLimit, scoringId, scoredAt: now, expiresAt, updatedAt: now },
    });
  return { creditLimit, expiresAt };
}

/**
 * Most recently added card, mapped for the criteria breakdown. Null if none.
 *
 * A client never picks a card — "the card" for a self-scoring run is simply the
 * last one they added. `plumCardId` rides along for the plum_card pipeline; it is
 * null on rows written before the attachment id and the card id were told apart
 * (see user_cards), and such a card cannot be scored at Plumgate.
 */
async function loadLatestCard(
  userId: number,
): Promise<(LimitCard & { plumCardId: string | null; expiry: string | null }) | null> {
  const [row] = await db
    .select()
    .from(userCards)
    .where(eq(userCards.userId, userId))
    .orderBy(desc(userCards.createdAt))
    .limit(1);
  if (!row) return null;
  return {
    pcType: +row.pcType,
    maskedPan: row.maskedPan,
    holderName: row.holderName,
    plumCardId: row.plumCardId,
    expiry: row.expiry,
  };
}

/**
 * The user's newest card that Plum can actually score, or null.
 *
 * A card with no `plumCardId` (a row predating the two Plum ids being told apart)
 * is a card we hold but cannot score, and plum_card now gates the model — so for
 * scoring purposes it is the same as having no card at all. Treating it as one
 * here is what keeps an unscoreable card from being discovered only AFTER the
 * chargeable bureau reports have been bought.
 */
export async function loadScoreableCard(
  userId: number,
): Promise<(LimitCard & { plumCardId: string; expiry: string }) | null> {
  const card = await loadLatestCard(userId);
  if (!card?.plumCardId) return null;
  return { ...card, plumCardId: card.plumCardId, expiry: card.expiry };
}

/** True when the user holds a card the plum_card stage could run against. */
export async function hasScoreableCard(userId: number): Promise<boolean> {
  return (await loadScoreableCard(userId)) != null;
}

async function load077(claimId: string) {
  const [row] = await db
    .select()
    .from(katm077Reports)
    .where(eq(katm077Reports.claimId, claimId))
    .limit(1);
  return row?.demandId != null ? row : null;
}

async function loadInps(claimId: string) {
  const [row] = await db
    .select()
    .from(katmInpsReports)
    .where(eq(katmInpsReports.claimId, claimId))
    .limit(1);
  return row?.demandId != null ? row : null;
}

/**
 * Open the plum_card stage for a client run whose KATM gates have passed.
 *
 * Cardless runs PARK rather than fail: the applicant did nothing wrong and the
 * bureau reports are already bought, so the run waits at 'awaiting_card' and the
 * card-confirm route drives it on (see finalizeClientScoringIfReady).
 */
export async function startClientPlumStage(scoring: ScoringRow): Promise<ClientStepOutcome> {
  const card = await loadScoreableCard(scoring.userId!);
  if (!card) {
    await setCurrentPipeline(scoring.id, null);
    return { status: 'awaiting_card' };
  }

  await openPlumStage(scoring.id);

  let outcome;
  try {
    outcome = await enqueuePlumCardScore({
      scoringId: scoring.id,
      cardId: card.plumCardId,
      pcType: +card.pcType,
      expiry: card.expiry, //TODO need to remove static data
    });
  } catch (err) {
    // The stage gates the model, so failing to even start it fails the run — it
    // is not something to score around. Retryable: no 0-limit cooldown.
    await recordPipeline(scoring.id, 'plum_card', {
      status: 'error',
      raw: { error: (err as Error).message },
    });
    await markError(scoring.id);
    return { status: 'error' };
  }

  // 'queued' ⇒ the worker owns the run from here and the app polls /status.
  if (outcome === 'queued') return { status: 'pending' };

  // 'skipped' (kill-switch off) or 'ready' (a recent scoring of this card was
  // reused) — nothing to wait for, so take the claim and run the model now.
  const claimed = await claimModelStage(scoring.id);
  if (!claimed) return { status: 'pending' };
  return runClientModel(claimed);
}

/** The model stage of a client run. PRECONDITION: the caller holds the claim. */
export async function runClientModel(
  scoring: ScoringRow,
): Promise<Extract<ClientStepOutcome, { status: 'scored' | 'rejected' | 'error' }>> {
  const userId = scoring.userId!;

  // The active_deal gate ran at the top of the chain; the limit gets written down
  // here, a whole KATM round trip later. A deal signed in between would have had
  // its limit row deleted by createDeal, and this write would hand it straight
  // back — leaving the client holding an open deal AND a reusable limit, which is
  // the one state the rule exists to forbid. So the gate is asked again, last,
  // where the answer is the one that matters.
  //TODO need to uncommit code below
  // const blocking = await loadBlockingDeal(userId);
  // if (blocking) {
  //   await recordPipeline(scoring.id, 'active_deal', {
  //     status: 'rejected',
  //     rejectReasonCode: 'active_deal_exists',
  //     summary: { hasActiveDeal: true, blockingDealNumber: blocking.dealNumber },
  //     raw: blocking,
  //   });
  //   await markRejected(scoring.id, 'active_deal_exists');
  //   return { status: 'rejected', reasonCode: 'active_deal_exists' };
  // }

  const card = await loadLatestCard(userId);

  const resolvedModel = await resolveScoringModel(db);
  if (!resolvedModel) {
    await recordPipeline(scoring.id, 'model_score', { status: 'error' });
    await markError(scoring.id);
    return { status: 'error' };
  }

  const [userRow] = await db
    .select({
      birthDate: users.birthDate,
      gender: users.gender,
      nationality: users.nationality,
      citizenship: users.citizenShipId,
      region: users.regionCode,
      address: users.address,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  const katm = scoring.katmClaimId ? await load077(scoring.katmClaimId) : null;

  const result = runModelAndLimit({
    model: resolvedModel.params,
    userRow: userRow ?? null,
    katm,
    card,
    // Income is the card's observed monthly turnover floor — same input as the
    // merchant path, so a client's self-scored limit matches the counter's.
    incomesInSom: await loadPlumTurnoverFloor(scoring.id),
  });

  await recordPipeline(scoring.id, 'model_score', {
    status: 'passed',
    summary: { score: result.scoreSum, platformCreditLimit: result.platformCreditLimit },
    raw: result.engineResult,
  });

  if (result.decision === 'approve') {
    await markScored(scoring.id, {
      score: result.scoreSum,
      creditLimit: String(result.platformCreditLimit),
      criteriaScores: result.criteriaScores,
    });
  } else {
    await markRejected(scoring.id, result.engineRejected ? 'model_stop_factor' : 'zero_limit');
  }

  // reject collapses to a 0 limit (the reason stays on the scorings run).
  const limit = result.decision === 'approve' ? String(result.platformCreditLimit) : '0';
  await writeClientCreditLimit(userId, scoring.id, limit);

  // Notify the terminal result (inbox + push). Idempotent per run via dedupeKey.
  if (result.decision === 'approve') {
    await notify({
      userId,
      type: 'scoring_approved',
      data: { creditLimit: limit },
      dedupeKey: `scoring_result:${scoring.id}`,
    });
  } else {
    await notify({
      userId,
      type: 'scoring_rejected',
      data: { reasonCode: result.engineRejected ? 'model_stop_factor' : 'zero_limit' },
      dedupeKey: `scoring_result:${scoring.id}`,
    });
  }

  return { status: 'scored', creditLimit: limit };
}

/** Entry point for the BullMQ worker once Plum has answered and it holds the claim. */
export async function finalizeClientAfterPlum(scoring: ScoringRow): Promise<void> {
  await runClientModel(scoring);
}

/**
 * Re-drive a run that failed at the plum stage, WITHOUT re-buying KATM.
 *
 * A Plum timeout is a technical failure of the last stage; 077 and INPS are
 * already stored under this run's claimId and are still perfectly good. Opening a
 * new run would re-register a claim and re-charge for both, which would make a
 * vendor hiccup cost real money per applicant.
 *
 * Returns null when there is nothing to resume — no claim, or reports that never
 * completed — in which case the caller opens a fresh run as usual.
 */
export async function resumeErroredClientRun(
  scoring: ScoringRow,
): Promise<ClientStepOutcome | null> {
  if (!scoring.katmClaimId) return null;
  const [katm, inps] = await Promise.all([
    load077(scoring.katmClaimId),
    loadInps(scoring.katmClaimId),
  ]);
  if (!katm || !inps) return null;
  return startClientPlumStage(scoring);
}

/**
 * Lazy entry point — used by POST /start and by card-confirm. Advances whatever
 * the user's current run is waiting on, and is a no-op when there is nothing to
 * advance.
 *
 * Also the fallback that stops a dead worker stalling a run forever: a run parked
 * on a plum_card row that has since resolved is finalized here, under the same
 * CAS the worker uses, so only one of them ever runs the model.
 */
export async function finalizeClientScoringIfReady(
  userId: number,
): Promise<Extract<ClientStepOutcome, { status: 'scored' | 'rejected' | 'error' }> | null> {
  const scoring = await loadClientScoringAwaitingModel(userId);
  if (!scoring) return null;

  // Parked with no card (or an unscoreable one) — open the stage if a card has
  // since arrived, otherwise keep waiting.
  if (scoring.currentPipeline == null) {
    const outcome = await startClientPlumStage(scoring);
    return outcome.status === 'scored' ||
      outcome.status === 'rejected' ||
      outcome.status === 'error'
      ? outcome
      : null;
  }

  if (scoring.currentPipeline !== 'plum_card') return null;

  const plum = await loadPipeline(scoring.id, 'plum_card');
  if (plum?.status !== 'passed') return null; // vendor still working

  const claimed = await claimModelStage(scoring.id);
  if (!claimed) return null; // the worker got there first
  return runClientModel(claimed);
}

/**
 * Apply one pipeline step to a client run. Shared by the /start handler (sync
 * path) and the KATM poller (async path). Performs side effects and returns the
 * outcome; enqueue of a follow-up poll is left to the caller (no poller import).
 */
export async function applyClientStep(
  step: PipelineStepResult,
  scoring: ScoringRow,
): Promise<ClientStepOutcome> {
  if (step.kind === 'enqueue_poll') {
    return { status: 'pending', enqueue: { reportType: step.reportType, token: step.token } };
  }
  if (step.kind === 'rejected') {
    // scorings is already marked 'rejected' by the pipeline. A DURABLE knockout
    // additionally earns the 0-limit cooldown, which is what stops a declined
    // applicant re-firing chargeable KATM every time they open the app.
    //
    // A retryable one must not: the applicant can go and fix its cause — fill in
    // the field, unlock their One ID, close their deal — and a week's lockout
    // after they had would be a bug wearing the costume of a policy. Nor do they
    // get the "you were rejected" push; nothing was decided about them.
    if (!isRetryableRejectReason(step.reasonCode)) {
      await writeClientCreditLimit(scoring.userId!, scoring.id, '0');
      await notify({
        userId: scoring.userId!,
        type: 'scoring_rejected',
        data: { reasonCode: step.reasonCode },
        dedupeKey: `scoring_result:${scoring.id}`,
      });
    }
    return {
      status: 'rejected',
      reasonCode: step.reasonCode,
      ...(step.missingFields ? { missingFields: step.missingFields } : {}),
    };
  }
  if (step.kind === 'failed') {
    return { status: 'failed', reason: step.reason };
  }
  // gates_passed — the KATM knockouts are clear, so the chargeable card scoring
  // may now run. It gates the model; the model no longer runs here.
  return startClientPlumStage(scoring);
}
