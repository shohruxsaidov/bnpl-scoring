// ---------------------------------------------------------------------------
// Client limit offers — the per-month limit rendered as "what you can take, over
// how long", for the mobile app's home screen.
//
// Reads the same `user_credit_limits` row the merchant wizard reuses, under the
// SAME eligibility predicates (see reusable-limit.handler.ts). That parity is the
// point: a client whose phone shows offers must be a client the agent's wizard
// will let skip scoring, or the app promises something the counter refuses.
// ---------------------------------------------------------------------------
import { and, eq, gt, isNotNull, sql } from 'drizzle-orm';
import { db } from '@db';
import { userCreditLimits } from '@db/user-credit-limits';
import { scorings } from '@db/scorings';
import { effectiveLimitOf } from '../../scoring/effective-limit';

/**
 * The terms offered in the app, in months.
 *
 * A fixed list, deliberately: it is the app's menu, and a stable menu is worth
 * more here than tracking the tariff table. It is NOT derived from `tariffs`, so
 * it can drift — deactivating every 18-month tariff leaves this still offering
 * 18 months, and a new 36-month tariff will not appear without a deploy.
 *
 * It is also platform-wide. Tariffs are assigned per merchant (merchant_tariffs),
 * so a term shown here may not exist at the shop the client actually walks into.
 * Both are accepted: the client app has no merchant context to narrow by yet.
 */
export const CLIENT_LIMIT_TERMS = [6, 9, 12, 18, 24] as const;

export interface LimitOffer {
  months: number;
  /** Whole som. What the client would OWE over the term — see effective-limit.ts. */
  amount: number;
}

/**
 * The client's usable per-month limit in whole som, or 0 when there is none.
 *
 * Zero covers every unusable case alike — never scored, rejected (the row is
 * written as '0'), expired, or spent on a deal (create-deal deletes the row).
 * The caller has no field to explain which, and does not need one: /status owns
 * that vocabulary and the app already polls it.
 */
async function loadUsableMonthlyLimit(userId: number): Promise<number> {
  const [row] = await db
    .select({ creditLimit: userCreditLimits.creditLimit })
    .from(userCreditLimits)
    // Drops rows whose source scoring vanished, exactly as the wizard does.
    .innerJoin(scorings, eq(scorings.id, userCreditLimits.scoringId))
    .where(
      and(
        eq(userCreditLimits.userId, userId),
        isNotNull(userCreditLimits.scoringId),
        gt(userCreditLimits.expiresAt, sql`now()`),
        // credit_limit is a varchar of whole som — cast, or '0' would compare
        // lexicographically.
        sql`${userCreditLimits.creditLimit}::numeric > 0`,
      ),
    )
    .limit(1);

  const perMonth = Number(row?.creditLimit);
  return Number.isFinite(perMonth) && perMonth > 0 ? perMonth : 0;
}

/**
 * One offer per term. Always the full list — a client with no usable limit gets
 * every term at 0 rather than an empty array, so the response shape never varies
 * and the app renders from a constant number of rows.
 */
export async function loadLimitOffers(userId: number): Promise<LimitOffer[]> {
  const perMonth = await loadUsableMonthlyLimit(userId);
  return CLIENT_LIMIT_TERMS.map((months) => ({
    months,
    amount: effectiveLimitOf(perMonth, months),
  }));
}
