/**
 * KATM integration — Kredit Axborot Tizimi Markazi (Uzbekistan Credit Bureau)
 *
 * Vendor base URL : KATM_BASE_URL
 * Auth            : Basic Auth (KATM_LOGIN / KATM_PASSWORD)
 * Report type     : 077 (InfoScore JSON)
 * All requests are logged to integration_logs.
 */

import ky from 'ky'
import type { Db } from '../../../db'
import { env } from '../../../env'
import { IntegrationError } from '../../../lib/integrations'
import { logIntegration } from '../log'
import { mockQueryInfoscore } from './mock'

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

function makeKatmClient() {
  if (!env.KATM_LOGIN || !env.KATM_PASSWORD) {
    throw new Error('KATM_LOGIN / KATM_PASSWORD are not configured')
  }
  const credentials = Buffer.from(`${env.KATM_LOGIN}:${env.KATM_PASSWORD}`).toString('base64')
  const base = env.KATM_BASE_URL.endsWith('/') ? env.KATM_BASE_URL : `${env.KATM_BASE_URL}/`
  return ky.create({
    baseUrl: base,
    timeout: env.KATM_TIMEOUT,
    retry: 0,
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  })
}

// ---------------------------------------------------------------------------
// Vendor response types (matches real KATM InfoScore 077 JSON response)
// ---------------------------------------------------------------------------

interface KatmSysinfo {
  demand_id: string
  consent_id: string
  consent_date: string
  claim_id: string
  demand_date_time: string
}

interface KatmOverview {
  claims_qty: string
  contracts_qty: string
  overdue_principal_qty: string
  max_overdue_principal_days: string
  max_overdue_principal_sum: string
  average_monthly_payment: string
  actual_average_monthly_payment: string
}

interface KatmScoringBlock {
  scoring_grade: string   // numeric string e.g. "424"
  scoring_class: string   // e.g. "A1"
  scoring_level: string   // e.g. "ОТЛИЧНЫЙ"
  scoring_version: string
}

interface KatmOpenContracts {
  open_contract: unknown[] | unknown
  all_debt_sum: string
  all_overdue_debt_sum: string
  average_monthly_payment: string
}

interface KatmCreditBan {
  credit_ban_status: string   // "0" = no ban
  credit_ban_date: string
}

interface KatmResponse {
  sysinfo: KatmSysinfo
  overview: KatmOverview
  scorring: KatmScoringBlock  // note: vendor typo — single 'r' in "scorring"
  open_contracts: KatmOpenContracts
  credit_ban: KatmCreditBan
}

// ---------------------------------------------------------------------------
// Public DTOs
// ---------------------------------------------------------------------------

export interface KatmResult {
  demandId: string
  consentId: string
  score: number
  scoringClass: string        // "A1", "A2", …, "F"
  scoringLevel: string        // "ОТЛИЧНЫЙ", "ХОРОШИЙ", etc.
  activeLoans: number
  allDebtSum: number          // UZS (not tiyin — KATM uses UZS directly)
  overdueCount: number
  overdueAmount: number       // UZS
  hasDefaults: boolean
  hasCreditBan: boolean
  /** Full raw vendor payload — persisted as infoscore_raw on the deal */
  raw: unknown
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toInt(s: string | undefined | null): number {
  const n = parseInt(s ?? '0', 10)
  return isNaN(n) ? 0 : n
}

function toFloat(s: string | undefined | null): number {
  const n = parseFloat(s ?? '0')
  return isNaN(n) ? 0 : n
}

function countOpenContracts(oc: KatmOpenContracts): number {
  if (!oc?.open_contract) return 0
  return Array.isArray(oc.open_contract) ? oc.open_contract.length : 1
}

function parseKatmResponse(data: KatmResponse): KatmResult {
  const { sysinfo, overview, scorring, open_contracts, credit_ban } = data
  const score = toInt(scorring?.scoring_grade)
  const overdueMaxDays = toInt(overview?.max_overdue_principal_days)

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
    hasDefaults: overdueMaxDays > 0 || toFloat(open_contracts?.all_overdue_debt_sum) > 0,
    hasCreditBan: credit_ban?.credit_ban_status !== '0',
    raw: data,
  }
}

// ---------------------------------------------------------------------------
// API method
// ---------------------------------------------------------------------------

export async function queryInfoscore(
  db: Db,
  params: {
    pinfl: string
    claimId: string
    consentId: string
  },
): Promise<KatmResult> {
  if (env.KATM_MOCK) return mockQueryInfoscore(params)

  const client = makeKatmClient()
  const reqBody = {
    pinfl: params.pinfl,
    claim_id: params.claimId,
    consent_id: params.consentId,
    consent_date: new Date().toISOString().slice(0, 10),
    report_type: '077',
  }

  const requestTimestamp = new Date()
  try {
    const data = await client
      .post('infoscore', { json: reqBody })
      .json<KatmResponse>()

    logIntegration(db, {
      integration: 'katm',
      methodName: 'infoscore',
      methodType: 'POST',
      request: reqBody,
      response: data,
      status: 200,
      errorMessage: null,
      requestTimestamp,
      responseTimestamp: new Date(),
    })

    return parseKatmResponse(data)
  } catch (err) {
    logIntegration(db, {
      integration: 'katm',
      methodName: 'infoscore',
      methodType: 'POST',
      request: reqBody,
      response: null,
      status: err instanceof IntegrationError ? err.statusCode : null,
      errorMessage: err instanceof Error ? err.message : String(err),
      requestTimestamp,
      responseTimestamp: new Date(),
    })
    throw err
  }
}
