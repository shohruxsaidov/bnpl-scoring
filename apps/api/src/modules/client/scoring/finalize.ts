import { and, desc, eq } from 'drizzle-orm';
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
  loadClientScoringAwaitingModel,
  markError,
  markRejected,
  markScored,
  recordPipeline,
  setCurrentPipeline,
  type ScoringRow,
} from '../../scoring/pipelines/store';
import type { PipelineStepResult } from '../../integrations/katm/flow';
import { enqueuePlumCardScore } from '../../integrations/plumgate/card-scoring';
import { notify } from '../notifications/service';

/** Credit-limit validity window before a re-score is allowed (Q: 7 days). */
export const CLIENT_LIMIT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Terminal/next-step outcome of a client run, returned to the caller (the
 * /start handler maps it to an HTTP response; the poller maps 'enqueue' to a
 * follow-up poll). Side effects (limit write, model run) already happened.
 */
export type ClientStepOutcome =
  | { status: 'pending'; enqueue: { reportType: '077' | 'inps' | 'mib'; token: string } }
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
): Promise<(LimitCard & { plumCardId: string | null }) | null> {
  const [row] = await db
    .select()
    .from(userCards)
    .where(eq(userCards.userId, userId))
    .orderBy(desc(userCards.createdAt))
    .limit(1);
  if (!row) return null;
  return {
    pcType: row.pcType,
    bank: row.pcType === 'humo' ? 'Humo' : 'Uzcard',
    maskedPan: row.maskedPan,
    holderName: row.holderName,
    plumCardId: row.plumCardId,
  };
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

export async function finalizeClientScoringIfReady(
  userId: number,
): Promise<Extract<ClientStepOutcome, { status: 'scored' | 'rejected' | 'error' }> | null> {
  const scoring = await loadClientScoringAwaitingModel(userId);
  if (!scoring) return null;

  // The active_deal gate ran at the top of the chain; the limit gets written down
  // here, a whole KATM round trip later. A deal signed in between would have had
  // its limit row deleted by createDeal, and this write would hand it straight
  // back — leaving the client holding an open deal AND a reusable limit, which is
  // the one state the rule exists to forbid. So the gate is asked again, last,
  // where the answer is the one that matters.
  const blocking = await loadBlockingDeal(userId);
  if (blocking) {
    await recordPipeline(scoring.id, 'active_deal', {
      status: 'rejected',
      rejectReasonCode: 'active_deal_exists',
      summary: { hasActiveDeal: true, blockingDealNumber: blocking.dealNumber },
      raw: blocking,
    });
    await markRejected(scoring.id, 'active_deal_exists');
    return { status: 'rejected', reasonCode: 'active_deal_exists' };
  }

  const card = await loadLatestCard(userId);

  await setCurrentPipeline(scoring.id, 'model_score');

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
  const inps = scoring.katmClaimId ? await loadInps(scoring.katmClaimId) : null;

  const result = runModelAndLimit({
    model: resolvedModel.params,
    userRow: userRow ?? null,
    katm,
    inps,
    card,
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

  // plum_card — observational card-behaviour scoring (does NOT feed the model).
  // Same rule as the merchant path: fired on reject as well as approve. Skipped
  // when the run reached the model with no card, or when the card predates the
  // plum_card_id column and so has no id the scoring rail would accept.
  if (card?.plumCardId) {
    await enqueuePlumCardScore({
      scoringId: scoring.id,
      plumCardId: card.plumCardId,
      pcType: card.pcType,
      maskedPan: card.maskedPan,
    });
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
  // gates_passed — try to finalize (needs a card). awaiting_card if none yet.
  const outcome = await finalizeClientScoringIfReady(scoring.userId!);
  return outcome ?? { status: 'failed', reason: 'Unknown error occurred' };
}
