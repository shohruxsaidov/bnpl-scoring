/**
 * KATM integration — Retail API of the Uzbekistan Credit Bureau (ADR-0025).
 *
 * Vendor base URL : KATM_BASE_URL ({base}/katm-api/v1)
 * Auth            : body-level — security.pLogin / security.pPassword
 * Org identity    : KATM_CODE (pCode) + KATM_HEAD (pHead)
 * Report type     : InfoScore 077, JSON (pReportId = KATM_REPORT_ID)
 *
 * Consume-only scope: ban check, claim registration, credit report
 * (+ status polling). Provider obligations are deferred — see ADR-0025.
 * All requests are logged to integration_logs (credentials redacted).
 */

import ky from 'ky';
import type { Db } from '../../../db';
import { env } from '../../../env';
import { IntegrationError } from '../../../lib/integrations';
import { logIntegration } from '../log';

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

function katmClient() {
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

function security() {
  return { pLogin: env.KATM_LOGIN, pPassword: env.KATM_PASSWORD };
}

/** KATM date format: yyyy-MM-dd'T'HH:mm:ss.SSSZ */
function katmDate(d: Date): string {
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

async function callKatm<T>(
  db: Db,
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

function assertOk(
  methodName: string,
  data: { result?: string; resultMessage?: string },
  alsoAllowed: string[] = [],
): void {
  const result = data.result ?? null;
  if (result === KATM_OK || (result && alsoAllowed.includes(result))) return;
  throw new KatmVendorError(methodName, result, data.resultMessage ?? null);
}

// ---------------------------------------------------------------------------
// 1. Ban-registry pre-check — /client/credit/ban/status
// ---------------------------------------------------------------------------

export async function checkCreditBan(
  db: Db,
  params: { pinfl: string },
): Promise<{ banned: boolean }> {
  const data = await callKatm<{ status?: number }>(db, 'client/credit/ban/status', {
    security: security(),
    data: {
      pHead: env.KATM_HEAD,
      pCode: env.KATM_CODE,
      pIdentifier: params.pinfl,
      pSubjectType: 2, // physical person
    },
  });
  assertOk('client/credit/ban/status', data);
  return { banned: data.status === 1 };
}

// ---------------------------------------------------------------------------
// 2. Claim registration — /claim/registration
// ---------------------------------------------------------------------------

export interface RegisterClaimParams {
  claimId: string;
  agreementId: string;
  agreementDate: Date;
  pinfl: string;
  docSeries: string;
  docNumber: string;
  docType: number; // 0 — ID card, 6 — biometric passport
  regionCode: string; // dict 016
  districtCode: string; // dict 052
  address: string;
  phone: string;
  amount: number;
}

export interface RegisterClaimResult {
  /** KATM-SIR — the bureau's subject identifier */
  katmSir: string;
  /** Bureau-verified passport echo, kept for the audit trail */
  verified: Record<string, unknown>;
}

export async function registerClaim(
  db: Db,
  params: RegisterClaimParams,
): Promise<RegisterClaimResult> {
  const now = new Date();
  const creditEndDate = new Date(now);
  creditEndDate.setMonth(creditEndDate.getMonth() + env.KATM_CLAIM_TERM_MONTHS);

  const data = await callKatm<Record<string, unknown> & { clientId?: string }>(
    db,
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

// ---------------------------------------------------------------------------
// 3. Credit report — /credit/report (+ /credit/report/status polling)
// ---------------------------------------------------------------------------

export type ReportOutcome =
  | { status: 'ready'; result: KatmResult }
  | { status: 'pending'; token: string };

interface ReportData {
  reportBase64?: string;
  token?: string;
}

function decodeReport(methodName: string, base64: string): KatmResult {
  let parsed: KatmResponse;
  try {
    parsed = JSON.parse(Buffer.from(base64, 'base64').toString('utf8')) as KatmResponse;
  } catch {
    throw new KatmVendorError(methodName, KATM_OK, 'reportBase64 is not valid JSON');
  }
  return parseKatmResponse(parsed);
}

export async function request077Report(
  db: Db,
  params: { claimId: string },
): Promise<ReportOutcome> {
  const data = await callKatm<ReportData>(db, 'v1/credit/report', {
    security: security(),
    data: {
      pHead: env.KATM_HEAD,
      pCode: env.KATM_CODE,
      pLegal: 1, // 1 — physical person (per spec v12.4)
      pClaimId: params.claimId,
      pReportId: '077',
      pLang: 'ru',
      pReportFormat: 1, // JSON
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

export async function checkReportStatus(
  db: Db,
  params: { claimId: string; token: string },
): Promise<ReportOutcome> {
  const data = await callKatm<ReportData>(db, 'v1/credit/report/status', {
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

// ---------------------------------------------------------------------------
// InfoScore 077 payload (matches real KATM InfoScore 077 JSON response)
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
  scoring_grade: string; // numeric string e.g. "424"
  scoring_class: string; // e.g. "A1"
  scoring_level: string; // e.g. "ОТЛИЧНЫЙ"
  scoring_version: string;
}

interface KatmOpenContracts {
  open_contract: unknown[] | unknown;
  all_debt_sum: string;
  all_overdue_debt_sum: string;
  average_monthly_payment: string;
}

interface KatmCreditBan {
  credit_ban_status: string; // "0" = no ban
  credit_ban_date: string;
}

export interface KatmResponse {
  sysinfo: KatmSysinfo;
  overview: KatmOverview;
  scorring: KatmScoringBlock; // note: vendor typo — single 'r' in "scorring"
  open_contracts: KatmOpenContracts;
  credit_ban: KatmCreditBan;
}

// ---------------------------------------------------------------------------
// Public DTO — unchanged from the previous integration so the scoring engine
// and session stamps keep working (the 077 payload shape is the same report)
// ---------------------------------------------------------------------------

export interface KatmResult {
  demandId: string;
  consentId: string;
  score: number;
  scoringClass: string; // "A1", "A2", …, "F"
  scoringLevel: string; // "ОТЛИЧНЫЙ", "ХОРОШИЙ", etc.
  activeLoans: number;
  allDebtSum: number; // UZS (not tiyin — KATM uses UZS directly)
  overdueCount: number;
  overdueAmount: number; // UZS — max_overdue_principal_sum
  maxOverdueDays: number; // max_overdue_principal_days
  totalContracts: number; // overview.contracts_qty — all-time credit count
  totalClaims: number; // overview.claims_qty — bureau inquiries ever
  avgMonthlyPayment: number; // overview.actual_average_monthly_payment (UZS)
  hasDefaults: boolean;
  hasCreditBan: boolean;
  /** Full raw vendor payload — persisted on the session stamp */
  raw: unknown;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
