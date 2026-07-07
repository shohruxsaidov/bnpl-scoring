/**
 * Deal-session expiry sweep (BullMQ) — the active half of the reaper.
 *
 * A repeatable job (5-min cadence) flips every `active` session idle past the
 * TTL to `expired` and enqueues its KATM claim retraction. The lazy guard on
 * GET /active / POST / and loadOwnedActiveSession is the belt to this sweep's
 * suspenders: it stops an agent resuming a stale session between ticks, but the
 * sweep is what guarantees the abandoned-laptop case is reaped and its bureau
 * claim withdrawn, even if the agent never returns.
 */

import type { Queue } from 'bullmq';
import type { ClaimRejectJobData } from '../../integrations/katm/claim-reject';
import { sweepExpiredSessions } from './commands/expire-session/expire-session.handler';

export const DEAL_SESSION_SWEEP_QUEUE = 'deal-session-sweep';
export const DEAL_SESSION_SWEEP_INTERVAL_MS = 5 * 60 * 1000; // 5 min

export async function processDealSessionSweepJob(
  rejectQueue: Queue<ClaimRejectJobData>,
): Promise<number> {
  return sweepExpiredSessions(rejectQueue);
}
