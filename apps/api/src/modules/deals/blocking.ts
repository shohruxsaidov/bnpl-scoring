// ---------------------------------------------------------------------------
// One Active Deal — a client may carry at most one open deal, platform-wide.
//
// A credit limit is a one-shot ticket, not a revolving budget: the deal it funds
// consumes it whole, whatever the deal is worth. So while a deal is open the
// client has no limit and cannot be scored — every entry point asks this module
// first, and `deals_user_active_idx` (see db/deals.ts) is what makes it true
// under concurrency, since a SELECT here cannot see another transaction's
// uncommitted insert.
//
// The only thing that clears the block is the deal closing, and the only thing
// that closes a deal is an admin recording its final payment — there is no
// ageing job and no auto-debit. Payment entry is therefore the sole unblock
// path, deliberately: routing around it would let the gate and the money ledger
// disagree about whether the client still owes us.
// ---------------------------------------------------------------------------
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@db';
import { deals } from '@db/deals';

/**
 * The deal statuses that hold the client's one slot.
 *
 * 'overdue' is never written today (nothing ages a deal), so a delinquent deal
 * simply stays 'active' and keeps blocking on its own. It is listed here so the
 * rule still holds the day an ageing job lands.
 */
export const BLOCKING_DEAL_STATUSES = ['active', 'overdue'] as const;

export interface BlockingDeal {
  id: string;
  dealNumber: number | null;
  status: string;
}

/** The deal holding this client's slot, or null when the slot is free. */
export async function loadBlockingDeal(userId: number): Promise<BlockingDeal | null> {
  const [row] = await db
    .select({ id: deals.id, dealNumber: deals.dealNumber, status: deals.status })
    .from(deals)
    .where(and(eq(deals.userId, userId), inArray(deals.status, [...BLOCKING_DEAL_STATUSES])))
    .limit(1);
  return row ?? null;
}

/**
 * Postgres unique-violation on a named index.
 *
 * Drizzle wraps driver errors, so the thrown object carries neither `code` nor
 * `constraint` — the real PostgresError hangs off `.cause`, and postgres.js spells
 * the field `constraint_name`. Both shapes are checked because the wrapping is a
 * library detail we do not want this rule to depend on: a version bump that stops
 * wrapping must not silently turn the race back into a 500.
 */
function isUniqueViolation(err: unknown, constraint: string): boolean {
  type PgLike = { code?: string; constraint?: string; constraint_name?: string; cause?: unknown };
  for (
    let e = err as PgLike | null | undefined, depth = 0;
    e && depth < 4;
    e = e.cause as PgLike, depth++
  ) {
    if (e.code === '23505' && (e.constraint ?? e.constraint_name) === constraint) return true;
  }
  return false;
}

/** Lost the race for the client's one open deal slot. */
export function isActiveDealConflict(err: unknown): boolean {
  return isUniqueViolation(err, 'deals_user_active_idx');
}

/**
 * Lost the race to build the Deal for a session — two OTP confirmations for the
 * same run landed at once. Distinct from the above: this one is not a refusal,
 * it means the deal the caller wanted already exists and should be read back.
 */
export function isDealSessionConflict(err: unknown): boolean {
  return isUniqueViolation(err, 'deals_deal_session_idx');
}
