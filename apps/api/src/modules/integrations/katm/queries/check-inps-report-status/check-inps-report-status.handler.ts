import { env } from '@env';
import {
  callKatm,
  assertOk,
  security,
  KATM_REPORT_PENDING,
  decodeReport,
  parseInpsReportResponse,
} from '../../service/shared';
import type { InpsReportOutcome, InpsReportResponse, ReportData } from '../../service/shared';

export type { InpsReportOutcome } from '../../service/shared';

export async function checkInpsReportStatus(params: {
  claimId: string;
  token: string;
}): Promise<InpsReportOutcome> {
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
  const raw = decodeReport<InpsReportResponse>('credit/report/status', data.reportBase64);
  return { status: 'ready', result: parseInpsReportResponse(raw) };
}
