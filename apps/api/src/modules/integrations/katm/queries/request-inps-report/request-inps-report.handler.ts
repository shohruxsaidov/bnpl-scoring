import { env } from '@env';
import {
  callKatm,
  assertOk,
  security,
  KATM_REPORT_PENDING,
  KatmVendorError,
  decodeReport,
  parseInpsReportResponse,
} from '../../service/shared';
import type { InpsReportOutcome, InpsReportResponse, ReportData } from '../../service/shared';

export type { InpsReportOutcome } from '../../service/shared';

export async function requestINPSReport(params: { claimId: string }): Promise<InpsReportOutcome> {
  const data = await callKatm<ReportData>('v1/credit/report', {
    security: security(),
    data: {
      pHead: env.KATM_HEAD,
      pCode: env.KATM_CODE,
      pLegal: 1,
      pClaimId: params.claimId,
      pReportId: '025',
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
  const raw = decodeReport<InpsReportResponse>('credit/inps-report', data.reportBase64);
  return { status: 'ready', result: parseInpsReportResponse(raw) };
}
