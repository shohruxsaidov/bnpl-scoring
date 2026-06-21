import ky, { HTTPError } from 'ky';
import { db } from '@db';
import { env } from '@env';
import { IntegrationError } from '../../../../lib/integrations';
import { logIntegration } from '../../log';

// ---------------------------------------------------------------------------
// Result codes
// ---------------------------------------------------------------------------

export const KATM_OK = '05000';
export const KATM_REPORT_PENDING = '05050';

/** KATM rejected the claim because the client blocked access via One ID. */
export class KatmOneIdLockedError extends Error {
  constructor() {
    super('katm: client data locked by One ID');
    this.name = 'KatmOneIdLockedError';
  }
}

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
    const oneIdLocked =
      err instanceof HTTPError &&
      typeof (err.data as any)?.errorMessage === 'string' &&
      (err.data as any).errorMessage.startsWith('Locked. Data is blocked by OneID');
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
    if (oneIdLocked) throw new KatmOneIdLockedError();
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

interface KatmOverduePrincipalItem {
  overdue_principal_days: string;
  overdue_principal_sum: string;
}

interface KatmContractOverduePrincipals {
  overdue_principal: KatmOverduePrincipalItem | KatmOverduePrincipalItem[];
}

interface KatmContract {
  overdue_principals?: KatmContractOverduePrincipals | '' | null;
}

interface KatmContractsBlock {
  contract: KatmContract | KatmContract[];
}

export interface KatmResponse {
  sysinfo: KatmSysinfo;
  overview: KatmOverview;
  scorring: KatmScoringBlock; // note: vendor typo — single 'r' in "scorring"
  open_contracts: KatmOpenContracts;
  credit_ban: KatmCreditBan;
  contracts?: KatmContractsBlock;
}

export interface OverdueBuckets {
  overdue30Count: number;
  overdue30to60Count: number;
  overdue60to90Count: number;
  overdue90Count: number;
}

export function computeOverdueBuckets(raw: unknown): OverdueBuckets {
  const buckets: OverdueBuckets = {
    overdue30Count: 0,
    overdue30to60Count: 0,
    overdue60to90Count: 0,
    overdue90Count: 0,
  };

  const contractsBlock = (raw as KatmResponse)?.contracts;
  if (!contractsBlock) return buckets;

  const rawContracts = contractsBlock.contract;
  const contracts: KatmContract[] = Array.isArray(rawContracts)
    ? rawContracts
    : rawContracts
      ? [rawContracts]
      : [];

  for (const contract of contracts) {
    const principalsBlock = contract.overdue_principals;
    if (!principalsBlock) continue;

    const rawItems = (principalsBlock as KatmContractOverduePrincipals).overdue_principal;
    if (!rawItems) continue;

    const items: KatmOverduePrincipalItem[] = Array.isArray(rawItems) ? rawItems : [rawItems];
    let maxDays = 0;
    for (const item of items) {
      const d = parseInt(item.overdue_principal_days ?? '0', 10);
      if (!isNaN(d) && d > maxDays) maxDays = d;
    }

    if (maxDays <= 0) continue;
    if (maxDays >= 90) buckets.overdue90Count++;
    else if (maxDays >= 60) buckets.overdue60to90Count++;
    else if (maxDays >= 30) buckets.overdue30to60Count++;
    else buckets.overdue30Count++;
  }

  return buckets;
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
  overdue30Count: number;
  overdue30to60Count: number;
  overdue60to90Count: number;
  overdue90Count: number;
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

export function parseKatm077ReportResponse(data: KatmResponse): KatmResult {
  const { sysinfo, overview, scorring, open_contracts, credit_ban } = data;
  const score = toInt(scorring?.scoring_grade);
  const overdueMaxDays = toInt(overview?.max_overdue_principal_days);
  const buckets = computeOverdueBuckets(data);

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
    ...buckets,
    raw: data,
  };
}

// ---------------------------------------------------------------------------
// InfoScore 025 (INPS) response types + parser
// ---------------------------------------------------------------------------

export interface InpsIncomeEntry {
  period: string;
  orgname: string;
  send_date: string;
  num: string;
  inps_summa: string;
  income_summa: string;
  oper_date: string;
  org_inn: string;
}

interface InpsIncomesPeriod {
  incomes_period_begin: string;
  incomes_period_end: string;
  incomes_all_summa: string;
}

interface InpsSysinfo {
  id_demand: string;
}

interface InpsReportBody {
  incomes?: { income?: InpsIncomeEntry | InpsIncomeEntry[] };
  incomes_period?: InpsIncomesPeriod;
  sysinfo?: InpsSysinfo;
}

export interface InpsReportResponse {
  report: InpsReportBody;
}

export interface InpsResult {
  demandId: string;
  incomesAllSumma: number;
  periodBegin: string;
  periodEnd: string;
  incomes: InpsIncomeEntry[];
  raw: unknown;
}

export type InpsReportOutcome =
  | { status: 'ready'; result: InpsResult }
  | { status: 'pending'; token: string };

export function parseInpsReportResponse(data: InpsReportResponse): InpsResult {
  const report = data.report;
  const raw = report.incomes?.income;
  const incomes: InpsIncomeEntry[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return {
    demandId: report.sysinfo?.id_demand ?? '',
    incomesAllSumma: toFloat(report.incomes_period?.incomes_all_summa),
    periodBegin: report.incomes_period?.incomes_period_begin ?? '',
    periodEnd: report.incomes_period?.incomes_period_end ?? '',
    incomes,
    raw: data,
  };
}

export function decodeReport<T>(methodName: string, base64: string): T {
  let outer: T;
  try {
    outer = JSON.parse(Buffer.from(base64, 'base64').toString('utf8')) as T;
  } catch {
    throw new KatmVendorError(methodName, KATM_OK, 'reportBase64 is not valid JSON');
  }
  return outer;
}
