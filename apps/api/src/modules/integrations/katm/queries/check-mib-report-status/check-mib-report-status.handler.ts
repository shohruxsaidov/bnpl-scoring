import { env } from '@env';
import {
  callKatm,
  assertOk,
  security,
  KATM_REPORT_PENDING,
  decodeReport,
  parseMibReportResponse,
} from '../../service/shared';
import type { MibReportOutcome, ReportData, MibReportResponse } from '../../service/shared';

export type { MibReportOutcome } from '../../service/shared';

/** Poll an async MIB (315) report by token. Mirrors checkReportStatus for 077. */
export async function checkMibReportStatus(params: {
  claimId: string;
  token: string;
}): Promise<MibReportOutcome> {
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
  const raw = decodeReport<MibReportResponse>('credit/report/status', data.reportBase64);
  return { status: 'ready', result: parseMibReportResponse(raw) };
}
