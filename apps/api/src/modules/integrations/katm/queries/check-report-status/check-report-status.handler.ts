import { env } from '@env';
import { callKatm, assertOk, security, KATM_REPORT_PENDING, decodeReport } from '../../service/shared';
import type { ReportOutcome, ReportData } from '../../service/shared';

export type { ReportOutcome } from '../../service/shared';

export async function checkReportStatus(params: {
  claimId: string;
  token: string;
}): Promise<ReportOutcome> {
  const data = await callKatm<ReportData>('v1/credit/report/status', {
    security: security(),
    data: {
      pHead: env.KATM_HEAD,
      pCode: env.KATM_CODE,
      pToken: params.token,
      pClaimId: params.claimId,
      pReportFormat: 1,
    },
  });
  assertOk('credit/report/status', data, [KATM_REPORT_PENDING]);

  if (data.result === KATM_REPORT_PENDING || !data.reportBase64) {
    return { status: 'pending', token: params.token };
  }
  return { status: 'ready', result: decodeReport('credit/report/status', data.reportBase64) };
}
