import { env } from '@env';
import { callKatm, assertOk, security, katmDate } from '../../service/shared';
import type { RegisterClaimCommand } from './register-claim.command';

export interface RegisterClaimResult {
  /** KATM-SIR — the bureau's subject identifier */
  katmSir: string;
  /** Bureau-verified passport echo, kept for the audit trail */
  verified: Record<string, unknown>;
}

export async function registerClaim(params: RegisterClaimCommand): Promise<RegisterClaimResult> {
  const now = new Date();
  const creditEndDate = new Date(now);
  creditEndDate.setMonth(creditEndDate.getMonth() + env.KATM_CLAIM_TERM_MONTHS);

  const data = await callKatm<Record<string, unknown> & { clientId?: string }>(
    'v1/claim/registration',
    {
      security: security(),
      data: {
        pCode: env.KATM_CODE,
        pClaimId: params.claimId,
        pClaimDate: katmDate(now),
        pAgreementId: params.agreementId,
        pAgreementDate: katmDate(params.agreementDate),
        pPinfl: params.pinfl,
        pDocSeries: params.docSeries,
        pDocNumber: params.docNumber,
        pDocType: params.docType,
        pRegion: params.regionCode,
        pLocalRegion: params.districtCode,
        pAddress: params.address,
        pPhone: params.phone,
        // Fixed applied amount/term (ADR-0025) — the Tariff and Basket do not
        // exist yet when the claim is registered at the Клиент step
        pCreditAmount: params.amount,
        pCurrency: 860,
        pCreditEndDate: katmDate(creditEndDate),
      },
    },
  );
  assertOk('claim/registration', data);

  const { result: _r, resultMessage: _m, ...verified } = data;
  return { katmSir: data.clientId ?? '', verified };
}
