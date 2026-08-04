// ---------------------------------------------------------------------------
// Rejection cooldown — reading a `user_credit_limits` row for what it actually
// means.
//
// One row, two meanings. A POSITIVE credit_limit is something the client can
// spend, and expires_at is its freshness window. A '0' credit_limit is not "a
// limit of nothing": it is the lockout a DURABLE rejection leaves behind, and
// expires_at is the moment that lockout lifts. The two are told apart by the
// value alone, which is safe because nothing else can produce a '0' row —
// create-deal DELETES the row when a deal consumes the limit rather than
// zeroing it, and runModelAndLimit can never approve for 0 (compute-limit.ts:
// `platformCreditLimit === 0` forces decision 'reject').
//
// Both readings are derived here rather than stored, so POST /start's refusal
// and GET /status's answer are the same predicate by construction. A separate
// cooldown_until column would be a second source of truth that drifts the first
// time someone changes one gate and forgets the other.
// ---------------------------------------------------------------------------
import type { userCreditLimits } from '@db/user-credit-limits';

type LimitRow = typeof userCreditLimits.$inferSelect;

/** True when the row is a rejection cooldown marker, not a spendable limit. */
export function isCooldownRow(row: LimitRow | null | undefined): boolean {
  return row != null && !(Number(row.creditLimit) > 0);
}

/**
 * The row read as a LIMIT — null when it is really a cooldown marker.
 *
 * Callers use this wherever they would have used the raw row for creditLimit /
 * expiresAt / expired, so a cooldown is never reported to the app as "a limit of
 * 0 expiring on <date>".
 */
export function spendableLimit(row: LimitRow | null | undefined): LimitRow | null {
  return row != null && !isCooldownRow(row) ? row : null;
}

/**
 * The moment a client-initiated scoring run may next be opened, or null when one
 * may be opened right now.
 *
 * NOT a prediction that the run will pass — an applicant knocked out for their
 * date of birth is welcome to try again the moment this lapses, and will be
 * knocked out again. It states only when the door is unlocked.
 *
 * Scoped to the client app. The merchant wizard does NOT consult this: a miss on
 * reusable-limit sends it down the full scoring path, chargeable bureau calls
 * and all (see deal-sessions /start). Whether that should change is a product
 * decision about turning walk-in customers away, not a detail of this predicate.
 */
export function retryAvailableAt(
  row: LimitRow | null | undefined,
  now: number = Date.now(),
): Date | null {
  if (!isCooldownRow(row)) return null;
  return row!.expiresAt.getTime() > now ? row!.expiresAt : null;
}
