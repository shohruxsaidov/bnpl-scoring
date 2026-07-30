// ---------------------------------------------------------------------------
// Merchant scoring finalize — the model stage of a wizard run.
//
// Extracted from POST /:id/cards/score because the model no longer runs inside
// that request: plum_card gates it, so the model runs whenever Plum resolves —
// from the BullMQ worker, or from the polling GET as the fallback. Both call in
// here, and the CAS in claimModelStage() guarantees only one of them wins.
//
// Does NOT import card-scoring: the enqueue is the caller's job, which is what
// keeps the worker → finalize → enqueue cycle open.
// ---------------------------------------------------------------------------
import { eq } from 'drizzle-orm';
import type { Queue } from 'bullmq';
import { db } from '@db';
import { users } from '@db/schema';
import { katm077Reports } from '@db/katm-077-reports';
import { katmInpsReports } from '@db/katm-inps-reports';
import { dealSessions } from '../../deals/schema';
import { resolveScoringModel } from '../../scoring/resolve-model';
import { runModelAndLimit } from '../../scoring/compute-limit';
import {
  markError,
  markRejected,
  markScored,
  recordPipeline,
  type ScoringRow,
} from '../../scoring/pipelines/store';
import { enqueueClaimRejection, type ClaimRejectJobData } from '../../integrations/katm/claim-reject';
import { stepDataOf, type DealSessionRow } from './types';
import { saveStep } from './commands/save-step/save-step.handler';
import { stampScoring } from './commands/stamp-scoring/stamp-scoring.handler';
import { rejectSession } from './commands/reject-session/reject-session.handler';
import { clearPlumPending } from './commands/stamp-plum-pending/stamp-plum-pending.handler';

/**
 * The verdict payload. Superset of what the endpoint used to return: `score` and
 * `decision` and `rejectionReason` are added because the merchant portal already
 * reads them (step-card.vue's ServerScoreResult) and the old response never sent
 * them — the rejection banner had nothing to render its reason from. `scoreSum`
 * is kept alongside `score` so nothing that read the old field breaks.
 */
export interface MerchantScoreResult {
  status: 'scored';
  scoringId: string | null;
  score: number;
  scoreSum: number;
  coefficient: number;
  decision: 'approve' | 'reject';
  limit: number;
  criteriaScores: Record<string, unknown>;
  sessionClosed: boolean;
  rejectionReason: { code: string; factorKey?: string } | null;
}

export async function loadSessionRow(sessionId: string): Promise<DealSessionRow | null> {
  const [row] = await db.select().from(dealSessions).where(eq(dealSessions.id, sessionId)).limit(1);
  return row ?? null;
}

/**
 * Run the model for a wizard session and stamp the outcome onto it.
 *
 * PRECONDITION: the caller holds the model-stage claim (claimModelStage returned
 * a row) or the run has no scorings row at all (legacy session). Calling it
 * without the claim risks a second rejectSession and a second claim retraction.
 */
export async function finalizeMerchantScoring(
  session: DealSessionRow,
  scoringRun: ScoringRow | null,
  rejectQueue: Queue<ClaimRejectJobData>,
): Promise<MerchantScoreResult> {
  const data = stepDataOf(session);
  const pending = data.plumPending;
  if (!pending) throw new Error('plum_pending_missing');
  const { card, bailsmen } = pending;

  let katm: typeof katm077Reports.$inferSelect | null = null;
  let inps: typeof katmInpsReports.$inferSelect | null = null;
  if (session.katmClaimId) {
    const [report, inpsReport] = await Promise.all([
      db
        .select()
        .from(katm077Reports)
        .where(eq(katm077Reports.claimId, session.katmClaimId))
        .limit(1),
      db
        .select()
        .from(katmInpsReports)
        .where(eq(katmInpsReports.claimId, session.katmClaimId))
        .limit(1),
    ]);
    if (report[0]?.demandId != null) katm = report[0];
    if (inpsReport[0]?.demandId != null) inps = inpsReport[0];
  }

  const resolvedModel = await resolveScoringModel(db, session.merchantId);
  if (!resolvedModel) {
    if (scoringRun) {
      await recordPipeline(scoringRun.id, 'model_score', { status: 'error' });
      await markError(scoringRun.id);
    }
    throw new Error('no_scoring_model_available');
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
    .where(eq(users.id, session.userId!))
    .limit(1);

  // Single source of truth for the model run + limit formula + criteria
  // breakdown — shared with the client self-scoring path (compute-limit.ts).
  const {
    scoreSum,
    coefficient,
    decision: finalDecision,
    platformCreditLimit,
    criteriaScores,
    engineRejected,
    engineResult,
  } = runModelAndLimit({
    model: resolvedModel.params,
    userRow: userRow ?? null,
    katm,
    inps,
    card: { pcType: card.pcType, maskedPan: card.maskedPan, holderName: card.holderName },
  });

  // model_score is a pure execution marker: the row is 'passed' whenever the
  // model ran (approve, zero-limit, or stop-factor alike). The approve/reject
  // decision lives on the scorings rollup, not on this pipeline row.
  if (scoringRun) {
    await recordPipeline(scoringRun.id, 'model_score', {
      status: 'passed',
      summary: { score: scoreSum, platformCreditLimit },
      raw: engineResult,
    });
    if (finalDecision === 'approve') {
      await markScored(scoringRun.id, {
        score: scoreSum,
        creditLimit: String(platformCreditLimit),
        criteriaScores,
      });
    } else {
      await markRejected(scoringRun.id, engineRejected ? 'model_stop_factor' : 'zero_limit');
    }
  }

  // Scoring history persistence removed — to be rebuilt from scratch.
  const scoringId: string | null = null;

  const rejectionReason =
    finalDecision === 'reject'
      ? engineRejected
        ? {
            code: 'model_stop_factor',
            factorKey: (engineResult as { stopFactor?: string }).stopFactor,
          }
        : { code: 'zero_limit' }
      : null;

  // The card step is saved HERE rather than at request time on purpose: saveStep
  // advances currentStep, and a session resumed while Plum was still working must
  // come back to the card step, not past it.
  const sessionAfterCard = await saveStep(session, 'card', { ...card });

  await stampScoring(
    sessionAfterCard,
    {
      cardId: card.cardId,
      scoringId,
      scoreSum,
      coefficient,
      decision: finalDecision,
      platformCreditLimit,
      criteriaScores: criteriaScores as Record<string, unknown>,
      rejectionReason,
    },
    bailsmen,
  );

  if (finalDecision === 'reject') {
    await rejectSession(sessionAfterCard);
    await enqueueClaimRejection(rejectQueue, sessionAfterCard);
  }

  // Re-read: saveStep and stampScoring have both rewritten stepData since the row
  // above was loaded, so clearing from the stale copy would resurrect them.
  const latest = await loadSessionRow(session.id);
  if (latest) await clearPlumPending(latest);

  return {
    status: 'scored',
    scoringId,
    score: scoreSum,
    scoreSum,
    coefficient,
    decision: finalDecision,
    limit: platformCreditLimit,
    criteriaScores: criteriaScores as Record<string, unknown>,
    sessionClosed: finalDecision === 'reject',
    rejectionReason,
  };
}
