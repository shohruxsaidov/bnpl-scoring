import { and, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '@db';
import { userCreditLimits } from '@db/user-credit-limits';
import { scorings } from '@db/scorings';
import { deals } from '@db/deals';
import { BLOCKING_DEAL_STATUSES } from '../../../../deals/blocking';
import type { ScoringStamp } from '../../types';

// ---------------------------------------------------------------------------
// Reuse scoring (ADR — reuse scoring). A returning client who already
// self-scored in the mobile app carries a `user_credit_limits` row. When that
// row is unexpired and positive, the merchant wizard skips scoring entirely and
// reuses it: we rehydrate a ScoringStamp from the run that produced the limit
// so the deal keeps real denormalized score/criteria data.
//
// `coefficient` has no column on `scorings`, so we read it back out of the run's
// stored `criteria_scores.model` entry — the model revision that produced this
// limit may have since been re-authored, and rescoring it against today's bands
// would report a coefficient the stored limit was never derived from.
// (createDeal doesn't store it anyway — it's only carried for parity with the
// full-path stamp.)
//
// Eligibility lives in exactly one place — `selectEligibleLimits` below. The
// merchant portal previews the limit on the client-search screen while `/start`
// is what actually grants it; if those two ever disagreed, an agent would read a
// number aloud that the wizard then refuses to honour. Both go through the same
// query so they cannot.
// ---------------------------------------------------------------------------

export interface ReusableLimit {
  /** Per-month credit limit in whole som. */
  creditLimit: number;
  expiresAt: Date;
  /** The rehydrated scoring block to stamp onto the session. */
  stamp: ScoringStamp;
}

/** A limit that passed every reuse guard, minus the (costlier) stamp rehydration. */
export interface EligibleLimit {
  /** Per-month credit limit in whole som. */
  creditLimit: number;
  expiresAt: Date;
  scoring: typeof scorings.$inferSelect;
}

/**
 * The reuse-eligible limits for `userIds`, keyed by user id. Absent from the map
 * means the client must be scored from scratch: no row, expired, zero/rejected,
 * the source run is missing, or an open deal has already consumed it.
 *
 * The open-deal check is what keeps the One Active Deal rule enforceable at all:
 * a reuse hit skips the scoring pipeline outright, so without it the wizard
 * would sail past the active_deal stage and straight into a second deal. Falling
 * through routes the client down the full path instead, where stage 0 rejects
 * them with a reason the agent can read.
 *
 * Two set-based queries regardless of how many ids come in — client search asks
 * about a whole result page at once.
 */
async function selectEligibleLimits(userIds: number[]): Promise<Map<number, EligibleLimit>> {
  const out = new Map<number, EligibleLimit>();
  if (userIds.length === 0) return out;

  // The join drops rows whose source scoring vanished; the predicates drop
  // expired and non-positive ones.
  const rows = await db
    .select({ limit: userCreditLimits, scoring: scorings })
    .from(userCreditLimits)
    .innerJoin(scorings, eq(scorings.id, userCreditLimits.scoringId))
    .where(
      and(
        inArray(userCreditLimits.userId, userIds),
        isNotNull(userCreditLimits.scoringId),
        gt(userCreditLimits.expiresAt, sql`now()`),
        // credit_limit is a varchar of whole som — cast, or '0' would compare
        // lexicographically.
        sql`${userCreditLimits.creditLimit}::numeric > 0`,
      ),
    );
  if (rows.length === 0) return out;

  //TODO need to uncommit code below

  // const blocked = new Set(
  //   (
  //     await db
  //       .select({ userId: deals.userId })
  //       .from(deals)
  //       .where(
  //         and(
  //           inArray(
  //             deals.userId,
  //             rows.map((r) => r.limit.userId),
  //           ),
  //           inArray(deals.status, [...BLOCKING_DEAL_STATUSES]),
  //         ),
  //       )
  //   ).map((d) => d.userId),
  // );


  //TODO need to commit code below

  const blocked = new Set()


  for (const { limit, scoring } of rows) {
    if (blocked.has(limit.userId)) continue;
    const creditLimit = Number(limit.creditLimit);
    if (!Number.isFinite(creditLimit) || creditLimit <= 0) continue;
    out.set(limit.userId, { creditLimit, expiresAt: limit.expiresAt, scoring });
  }
  return out;
}

/**
 * The client's reusable limit with its scoring block rehydrated, or null when
 * they must be scored from scratch. This is the authoritative path — `/start`
 * grants exactly what this returns.
 */
export async function loadReusableLimit(userId: number): Promise<ReusableLimit | null> {
  const hit = (await selectEligibleLimits([userId])).get(userId);
  if (!hit) return null;

  const scoreSum = hit.scoring.score ?? 0;
  const criteriaScores = (hit.scoring.criteriaScores ?? {}) as Record<string, unknown>;
  const modelEntry = criteriaScores['model'] as { coefficient?: unknown } | undefined;
  const coefficient = typeof modelEntry?.coefficient === 'number' ? modelEntry.coefficient : 0;

  const stamp: ScoringStamp = {
    cardId: '',
    scoringId: hit.scoring.id.toString(),
    scoreSum,
    coefficient,
    decision: 'approve',
    platformCreditLimit: hit.creditLimit,
    criteriaScores,
  };

  return { creditLimit: hit.creditLimit, expiresAt: hit.expiresAt, stamp };
}

/**
 * Display-only view of the same rule, for showing a client's standing limit
 * before the wizard commits to anything. No stamp is built — nothing reads it.
 */
export async function loadReusableLimits(
  userIds: number[],
): Promise<Map<number, { creditLimit: number; expiresAt: Date }>> {
  const eligible = await selectEligibleLimits(userIds);
  return new Map(
    [...eligible].map(([id, { creditLimit, expiresAt }]) => [id, { creditLimit, expiresAt }]),
  );
}
