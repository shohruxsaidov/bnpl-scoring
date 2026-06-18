import { env } from '@env';
import { callKatm, assertOk, security, KATM_REPORT_PENDING, KatmVendorError, decodeReport } from '../../service/shared';
import type { ReportOutcome, ReportData } from '../../service/shared';

export type { ReportOutcome } from '../../service/shared';

export async function request077Report(params: { claimId: string }): Promise<ReportOutcome> {
  const data = await callKatm<ReportData>('v1/credit/report', {
    security: security(),
    data: {
      pHead: env.KATM_HEAD,
      pCode: env.KATM_CODE,
      pLegal: 1,
      pClaimId: params.claimId,
      pReportId: '077',
      pLang: 'ru',
      pReportFormat: 1,
    },
  });
  assertOk('credit/report', data, [KATM_REPORT_PENDING]);

  if (data.result === KATM_REPORT_PENDING) {
    if (!data.token)
      throw new KatmVendorError('credit/report', data.result, 'pending without Token');
    return { status: 'pending', token: data.token };
  }
  if (!data.reportBase64) {
    throw new KatmVendorError('credit/report', data.result ?? null, 'success without reportBase64');
  }
  return { status: 'ready', result: decodeReport('credit/report', data.reportBase64) };
}
