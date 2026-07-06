import { and, desc, eq } from 'drizzle-orm';
import { db } from '@db';
import { userCards } from '@db/user-cards';
import { userCreditLimits } from '@db/user-credit-limits';
import { katm077Reports } from '@db/katm-077-reports';
import { katmInpsReports } from '@db/katm-inps-reports';
import { users } from '@db/users';
import { resolveScoringModel } from '../../scoring/resolve-model';
import { runModelAndLimit, type LimitCard } from '../../scoring/compute-limit';
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

/** Most recently added card, mapped for the criteria breakdown. Null if none. */
async function loadLatestCard(userId: number): Promise<LimitCard | null> {
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
): Promise<Extract<ClientStepOutcome, { status: 'scored' | 'error' }> | null> {
  const scoring = await loadClientScoringAwaitingModel(userId);
  if (!scoring) return null;

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

  // reject collapses to a 0 limit (the reason stays on the scorings run).
  const limit = result.decision === 'approve' ? String(result.platformCreditLimit) : '0';
  await writeClientCreditLimit(userId, scoring.id, limit);
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
    // scorings already marked 'rejected' by the pipeline; surface a 0 limit.
    await writeClientCreditLimit(scoring.userId!, scoring.id, '0');
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
