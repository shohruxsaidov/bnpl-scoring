import { env } from '@env';
import {
  callKatm,
  assertOk,
  security,
  KATM_REPORT_PENDING,
  KatmVendorError,
  decodeReport,
  parseMibReportResponse,
} from '../../service/shared';
import type { MibReportOutcome, ReportData, MibReportResponse } from '../../service/shared';

export type { MibReportOutcome } from '../../service/shared';

/**
 * Request KATM report 315 (MIB — Бюро принудительного исполнения) for an already
 * registered claim. Transport mirrors 077 exactly; only pReportId differs and the
 * decoded payload is the lean { report: { resultCode, resultMessage } } envelope.
 */
export async function requestMibReport(params: { claimId: string }): Promise<MibReportOutcome> {
  const data = await callKatm<ReportData>('v1/credit/report', {
    security: security(),
    data: {
      pHead: env.KATM_HEAD,
      pCode: env.KATM_CODE,
      pLegal: 1,
      pClaimId: params.claimId,
      pReportId: '315',
      pLang: 'ru',
      pReportFormat: 1, // For json format 1; for xml format 0
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
  const raw = decodeReport<MibReportResponse>('credit/report', data.reportBase64);
  return { status: 'ready', result: parseMibReportResponse(raw) };
}
