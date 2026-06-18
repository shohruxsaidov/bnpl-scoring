import { env } from '@env';
import { callKatm, assertOk, security } from '../../service/shared';
import type { RegisterClaimCommand } from './register-claim.command';
const TERM_MONTH = 3;

export interface RegisterClaimResult {
  /** KATM-SIR — the bureau's subject identifier */
  katmSir: string;
  /** Bureau-verified passport echo, kept for the audit trail */
  verified: Record<string, unknown>;
}

export async function registerClaim(params: RegisterClaimCommand): Promise<RegisterClaimResult> {
  const now = new Date();
  const creditEndDate = new Date(now);
  creditEndDate.setMonth(creditEndDate.getMonth() + TERM_MONTH);

  const data = await callKatm<Record<string, unknown> & { clientId?: string }>(
    'v1/claim/registration',
    {
      security: security(),
      data: {
        pCode: env.KATM_CODE,
        pClaimId: params.claimId,
        pClaimDate: now.toISOString(),
        pAgreementId: params.agreementId,
        pAgreementDate: new Date(params.agreementDate).toISOString(),
        pPinfl: params.pinfl,
        pDocSeries: params.passportSeries,
        pDocNumber: params.passportNumber,
        pDocType: params.passportType,
        pRegion: params.regionCode,
        pLocalRegion: params.districtCode,
        pAddress: params.address,
        pPhone: params.phone,
        pCreditAmount: params.amount,
        pCurrency: 860, // 860 uz currency
        pCreditEndDate: creditEndDate.toISOString(),
      },
    },
  );
  assertOk('claim/registration', data);

  const { result: _r, resultMessage: _m, ...verified } = data;
  return { katmSir: data.clientId ?? '', verified };
}
