import ky from 'ky';
import { db } from '@db';
import { env } from '@env';
import { IntegrationError } from '../../../../lib/integrations';
import { logIntegration } from '../../log';

// ---------------------------------------------------------------------------
// Result codes
// ---------------------------------------------------------------------------

export const KATM_OK = '05000';
export const KATM_REPORT_PENDING = '05050';

/** Vendor-level failure: HTTP 200 but data.result is not a success code. */
export class KatmVendorError extends Error {
  constructor(
    public readonly methodName: string,
    public readonly result: string | null,
    public readonly resultMessage: string | null,
  ) {
    super(`katm ${methodName}: ${result ?? 'no result'} ${resultMessage ?? ''}`.trim());
    this.name = 'KatmVendorError';
  }
}

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export function katmClient() {
  if (!env.KATM_LOGIN || !env.KATM_PASSWORD || !env.KATM_CODE || !env.KATM_HEAD) {
    throw new Error('KATM_LOGIN / KATM_PASSWORD / KATM_CODE / KATM_HEAD are not configured');
  }
  const base = env.KATM_BASE_URL.endsWith('/') ? env.KATM_BASE_URL : `${env.KATM_BASE_URL}/`;
  return ky.create({
    baseUrl: base,
    timeout: env.KATM_TIMEOUT,
    retry: 0,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function security() {
  return { pLogin: env.KATM_LOGIN, pPassword: env.KATM_PASSWORD };
}

/** KATM date format: yyyy-MM-dd'T'HH:mm:ss.SSSZ */
export function katmDate(d: Date): string {
  return d.toISOString().replace(/Z$/, '+0000');
}

// ---------------------------------------------------------------------------
// Vendor envelope + low-level call helper
// ---------------------------------------------------------------------------

interface KatmEnvelope<T> {
  data?: T & { result?: string; resultMessage?: string };
  errorMessage?: string;
  code?: number;
}

export async function callKatm<T>(
  methodName: string,
  body: Record<string, unknown>,
): Promise<T & { result?: string; resultMessage?: string }> {
  const client = katmClient();
  const requestTimestamp = new Date();
  try {
    const envelope = await client.post(methodName, { json: body }).json<KatmEnvelope<T>>();

    logIntegration(db, {
      integration: 'katm',
      methodName,
      methodType: 'POST',
      request: body,
      response: envelope,
      status: envelope.code ?? 200,
      errorMessage: envelope.errorMessage ?? null,
      requestTimestamp,
      responseTimestamp: new Date(),
    });

    const data = envelope.data;
    if (!data) {
      throw new KatmVendorError(methodName, null, envelope.errorMessage ?? null);
    }
    return data;
  } catch (err) {
    if (!(err instanceof KatmVendorError)) {
      logIntegration(db, {
        integration: 'katm',
        methodName,
        methodType: 'POST',
        request: body,
        response: null,
        status: err instanceof IntegrationError ? err.statusCode : null,
        errorMessage: err instanceof Error ? err.message : String(err),
        requestTimestamp,
        responseTimestamp: new Date(),
      });
    }
    throw err;
  }
}

export function assertOk(
  methodName: string,
  data: { result?: string; resultMessage?: string },
  alsoAllowed: string[] = [],
): void {
  const result = data.result ?? null;
  if (result === KATM_OK || (result && alsoAllowed.includes(result))) return;
  throw new KatmVendorError(methodName, result, data.resultMessage ?? null);
}

// ---------------------------------------------------------------------------
// InfoScore 077 response types + parser
// ---------------------------------------------------------------------------

interface KatmSysinfo {
  demand_id: string;
  consent_id: string;
  consent_date: string;
  claim_id: string;
  demand_date_time: string;
}

interface KatmOverview {
  claims_qty: string;
  contracts_qty: string;
  overdue_principal_qty: string;
  max_overdue_principal_days: string;
  max_overdue_principal_sum: string;
  average_monthly_payment: string;
  actual_average_monthly_payment: string;
}

interface KatmScoringBlock {
  scoring_grade: string;
  scoring_class: string;
  scoring_level: string;
  scoring_version: string;
}

interface KatmOpenContracts {
  open_contract: unknown[] | unknown;
  all_debt_sum: string;
  all_overdue_debt_sum: string;
  average_monthly_payment: string;
}

interface KatmCreditBan {
  credit_ban_status: string;
  credit_ban_date: string;
}

export interface KatmResponse {
  sysinfo: KatmSysinfo;
  overview: KatmOverview;
  scorring: KatmScoringBlock; // note: vendor typo — single 'r' in "scorring"
  open_contracts: KatmOpenContracts;
  credit_ban: KatmCreditBan;
}

export interface KatmResult {
  demandId: string;
  consentId: string;
  score: number;
  scoringClass: string;
  scoringLevel: string;
  activeLoans: number;
  allDebtSum: number;
  overdueCount: number;
  overdueAmount: number;
  maxOverdueDays: number;
  totalContracts: number;
  totalClaims: number;
  avgMonthlyPayment: number;
  hasDefaults: boolean;
  hasCreditBan: boolean;
  /** Full raw vendor payload — persisted on the session stamp */
  raw: unknown;
}

export type ReportOutcome =
  | { status: 'ready'; result: KatmResult }
  | { status: 'pending'; token: string };

export interface ReportData {
  reportBase64?: string;
  token?: string;
}

function toInt(s: string | undefined | null): number {
  const n = parseInt(s ?? '0', 10);
  return isNaN(n) ? 0 : n;
}

function toFloat(s: string | undefined | null): number {
  const n = parseFloat(s ?? '0');
  return isNaN(n) ? 0 : n;
}

function countOpenContracts(oc: KatmOpenContracts): number {
  if (!oc?.open_contract) return 0;
  return Array.isArray(oc.open_contract) ? oc.open_contract.length : 1;
}

export function parseKatmResponse(data: KatmResponse): KatmResult {
  const { sysinfo, overview, scorring, open_contracts, credit_ban } = data;
  const score = toInt(scorring?.scoring_grade);
  const overdueMaxDays = toInt(overview?.max_overdue_principal_days);

  return {
    demandId: sysinfo?.demand_id ?? '',
    consentId: sysinfo?.consent_id ?? '',
    score,
    scoringClass: scorring?.scoring_class ?? '',
    scoringLevel: scorring?.scoring_level ?? '',
    activeLoans: countOpenContracts(open_contracts),
    allDebtSum: toFloat(open_contracts?.all_debt_sum),
    overdueCount: toInt(overview?.overdue_principal_qty),
    overdueAmount: toFloat(overview?.max_overdue_principal_sum),
    maxOverdueDays: overdueMaxDays,
    totalContracts: toInt(overview?.contracts_qty),
    totalClaims: toInt(overview?.claims_qty),
    avgMonthlyPayment: toFloat(overview?.actual_average_monthly_payment),
    hasDefaults: overdueMaxDays > 0 || toFloat(open_contracts?.all_overdue_debt_sum) > 0,
    hasCreditBan: credit_ban?.credit_ban_status !== '0',
    raw: data,
  };
}

export function decodeReport(methodName: string, base64: string): KatmResult {
  let parsed: KatmResponse;
  try {
    parsed = JSON.parse(Buffer.from(base64, 'base64').toString('utf8')) as KatmResponse;
  } catch {
    throw new KatmVendorError(methodName, KATM_OK, 'reportBase64 is not valid JSON');
  }
  return parseKatmResponse(parsed);
}
