/**
 * KATM claim retraction (BullMQ) — withdraw a registered claim when its deal
 * session is closed without becoming a deal (abandoned or scoring-rejected).
 *
 * The session-status write is the caller's job and stays authoritative and
 * synchronous; the KATM retraction is eventually consistent. A dedicated queue
 * (separate from the report-poll queue) gives it its own retry policy and no
 * scoring-failure finalizer — a failed retraction never touches the run.
 *
 * katm_claims.status advances 'created' → 'rejected' ONLY after KATM answers
 * success; a throw leaves it 'created' so BullMQ retries. On exhaustion the
 * job is kept (removeOnFail:false) and logged for manual re-drive.
 */

import { eq } from 'drizzle-orm';
import type { Queue } from 'bullmq';
import { db } from '@db';
import { katmClaims } from '@db/katm-claims';
import type { DealSessionRow } from '../../merchant/deal-sessions/types';
import { rejectClaim } from './commands/reject-claim/reject-claim.handler';

export const KATM_CLAIM_REJECT_QUEUE = 'katm-claim-reject';

export interface ClaimRejectJobData {
  claimId: string;
}

/**
 * Guard-and-enqueue. Idempotent: only a claim that exists and is still
 * 'created' is enqueued, and jobId=claimId dedups a double close (abandon
 * racing reject, or a double-tap). Skips silently when the session never
 * registered a claim.
 */
export async function enqueueClaimRejection(
  queue: Queue<ClaimRejectJobData>,
  session: Pick<DealSessionRow, 'katmClaimId'>,
): Promise<void> {
  const claimId = session.katmClaimId;
  if (!claimId) return;

  const [claim] = await db
    .select({ status: katmClaims.status })
    .from(katmClaims)
    .where(eq(katmClaims.claimId, claimId))
    .limit(1);
  if (!claim || claim.status !== 'created') return;

  await queue.add(
    'reject',
    { claimId },
    {
      jobId: new Date().toISOString() + '-' + claimId, // dedup double-close
      attempts: 1,
      backoff: { type: 'fixed', delay: 10_000 },
      removeOnComplete: true,
      removeOnFail: false,
    },
  );
}

/**
 * Worker body — retract the claim at KATM, then stamp katm_claims.status.
 * The status flips to 'rejected' only after rejectClaim returns without
 * throwing (KATM success); any throw propagates so BullMQ retries.
 */
export async function processClaimRejectJob(data: ClaimRejectJobData): Promise<void> {
  await rejectClaim({ claimId: data.claimId });
  await db
    .update(katmClaims)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(eq(katmClaims.claimId, data.claimId));
}
