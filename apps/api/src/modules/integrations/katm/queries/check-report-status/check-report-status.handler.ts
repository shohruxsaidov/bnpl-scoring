import { env } from '@env';
import {
  callKatm,
  assertOk,
  security,
  KATM_REPORT_PENDING,
  decodeReport,
  parseKatm077ReportResponse,
} from '../../service/shared';
import type { ReportOutcome, ReportData, KatmResponse } from '../../service/shared';

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
  const raw = decodeReport<{ report: KatmResponse }>('credit/report/status', data.reportBase64);
  return { status: 'ready', result: parseKatm077ReportResponse(raw.report) };
}
