import { env } from '@env';
import { callKatm, assertOk, security } from '../../service/shared';
import { RejectClaimCommand } from './reject-claim.command';

/**
 * Retract a registered KATM claim. Pure KATM adapter — persistence of the
 * resulting katm_claims.status lives in the reject worker (claim-reject.ts).
 * Throws (via assertOk) on a non-OK KATM response so the job retries.
 */
export async function rejectClaim(params: RejectClaimCommand): Promise<void> {
  const now = new Date();
  const data = await callKatm<Record<string, unknown>>('v1/claim/rejection', {
    security: security(),
    data: {
      pCode: env.KATM_CODE,
      pHead: env.KATM_HEAD,
      pIsUpdate: 0,
      pReason: '8',
      pReasonId: '08',
      pRejectDate: now.toISOString(),
      pClaimId: params.claimId,
    },
  });
}
