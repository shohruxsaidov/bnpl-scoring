import { and, eq, lt } from 'drizzle-orm';
import type { Queue } from 'bullmq';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import {
  enqueueClaimRejection,
  type ClaimRejectJobData,
} from '../../../../integrations/katm/claim-reject';
import { DEAL_SESSION_TTL_MS, isSessionStale, type DealSessionRow } from '../../types';

/**
 * Reap ONE stale session. The status flip is a conditional UPDATE guarded on
 * status='active', so exactly one caller (the sweep or the lazy guard on
 * GET /active / POST /) wins it. Only the winner enqueues the KATM claim
 * retraction — a claim that never became a deal is withdrawn exactly once.
 * Returns true iff THIS call performed the flip.
 */
export async function expireStaleSession(
  session: DealSessionRow,
  rejectQueue: Queue<ClaimRejectJobData>,
): Promise<boolean> {
  if (!isSessionStale(session)) return false;

  const [row] = await db
    .update(dealSessions)
    .set({ status: 'expired', updatedAt: new Date() })
    .where(and(eq(dealSessions.id, session.id), eq(dealSessions.status, 'active')))
    .returning({ id: dealSessions.id });

  // Lost the race — another sweep tick or the lazy guard already flipped it.
  if (!row) return false;

  await enqueueClaimRejection(rejectQueue, session);
  return true;
}

/**
 * Sweep body — reap every session idle past the TTL. Driven by a 5-min
 * repeatable BullMQ job. The candidate query pre-filters on status + updated_at;
 * expireStaleSession re-checks isSessionStale per row, which also enforces the
 * katmPending exemption. Returns the number of sessions this pass expired.
 */
export async function sweepExpiredSessions(
  rejectQueue: Queue<ClaimRejectJobData>,
): Promise<number> {
  const cutoff = new Date(Date.now() - DEAL_SESSION_TTL_MS);
  const candidates = await db
    .select()
    .from(dealSessions)
    .where(and(eq(dealSessions.status, 'active'), lt(dealSessions.updatedAt, cutoff)));

  let expired = 0;
  for (const session of candidates) {
    if (await expireStaleSession(session, rejectQueue)) expired += 1;
  }
  return expired;
}
