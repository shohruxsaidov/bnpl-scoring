import { eq } from 'drizzle-orm';
import { db } from '@db';
import { userCreditLimits } from '@db/user-credit-limits';
import { scorings } from '@db/scorings';
import { creditLimitIndexForScore } from '../../../../scoring/compute-limit';
import type { ScoringStamp } from '../../types';

// ---------------------------------------------------------------------------
// Reuse scoring (ADR — reuse scoring). A returning client who already
// self-scored in the mobile app carries a `user_credit_limits` row. When that
// row is unexpired and positive, the merchant wizard skips scoring entirely and
// reuses it: we rehydrate a ScoringStamp from the run that produced the limit
// so the deal keeps real denormalized score/criteria data.
//
// `coefficient` isn't persisted on `scorings`, so we recompute it from the score
// band (createDeal doesn't store it anyway — it's only carried for parity with
// the full-path stamp).
// ---------------------------------------------------------------------------

export interface ReusableLimit {
  /** Per-month credit limit in whole som. */
  creditLimit: number;
  expiresAt: Date;
  /** The rehydrated scoring block to stamp onto the session. */
  stamp: ScoringStamp;
}

/**
 * The client's reusable limit, or null when they must be scored from scratch
 * (no row, expired, zero/rejected, or the source run is missing). Only a valid,
 * positive, unexpired limit qualifies for reuse.
 */
export async function loadReusableLimit(userId: number): Promise<ReusableLimit | null> {
  const [limit] = await db
    .select()
    .from(userCreditLimits)
    .where(eq(userCreditLimits.userId, userId))
    .limit(1);

  if (!limit) return null;
  if (limit.expiresAt.getTime() <= Date.now()) return null;

  const creditLimit = Number(limit.creditLimit);
  if (!Number.isFinite(creditLimit) || creditLimit <= 0) return null;
  if (limit.scoringId == null) return null;

  const [source] = await db
    .select()
    .from(scorings)
    .where(eq(scorings.id, limit.scoringId))
    .limit(1);
  if (!source) return null;

  const scoreSum = source.score ?? 0;
  const stamp: ScoringStamp = {
    cardId: '',
    scoringId: source.id.toString(),
    scoreSum,
    coefficient: creditLimitIndexForScore(scoreSum),
    decision: 'approve',
    platformCreditLimit: creditLimit,
    criteriaScores: (source.criteriaScores ?? {}) as Record<string, unknown>,
  };

  return { creditLimit, expiresAt: limit.expiresAt, stamp };
}
