// ---------------------------------------------------------------------------
// Scoring pipeline domain types
// The ordered, cost-ascending knockout pipelines a scoring run walks before the
// numeric model is allowed to run. All stop-factors are hardcoded here, not
// configurable. See the scorings / scoring_pipelines tables.
// ---------------------------------------------------------------------------

// Ordered cost-ascending: cheap/free checks first so a knockout short-circuits
// before any chargeable bureau call.
// plum_card sits with the data-gathering stages, before the model verdict, even
// though it resolves asynchronously alongside/after it. It is OBSERVATIONAL: it
// has no stop-factors, feeds no model param, and never rejects — see config.ts.
export const PIPELINE_ORDER = [
  'myid',
  'katm_claim',
  'katm_mib',
  'katm_077',
  'katm_inps',
  'plum_card',
  'model_score',
] as const;
export type PipelineType = (typeof PIPELINE_ORDER)[number];

// scoring_pipelines.status
export type PipelineStatus = 'pending' | 'passed' | 'rejected' | 'error';

// scorings.status — 'passed' = all gates cleared, 'scored' = model done.
export type ScoringStatus = 'in_progress' | 'passed' | 'scored' | 'rejected' | 'error';

// scoring_pipelines.reject_reason_code — the hardcoded stop-factor that knocked out.
export type RejectReasonCode =
  // myid — business knockouts + per-field missing-data knockouts
  | 'address_absent'
  | 'age_below'
  | 'age_above'
  | 'not_resident_uzbekistan'
  | 'pinfl_absent'
  | 'passport_series_absent'
  | 'passport_number_absent'
  | 'doc_type_absent'
  | 'region_absent'
  | 'district_absent'
  | 'phone_absent'
  // katm_claim — registration knockout
  | 'oneid_locked'
  // katm_mib — active enforcement proceedings (Бюро принудительного исполнения)
  | 'mib_enforcement_found'
  // katm_077
  | 'credit_ban'
  | 'has_defaults'
  | 'judicial_or_decommissioned'
  | 'has_actual_overdue_debts_from_60_to_90'
  | 'has_actual_overdue_debts_from_30_to_60'
  // katm_inps
  | 'no_income';

// scorings.reject_reason_code may additionally carry a model-stage reason —
// these are NOT pipeline stop-factors (the model is not a pipeline).
export type ScoringRejectReasonCode = RejectReasonCode | 'model_stop_factor' | 'zero_limit';

// Coarse bucket the client UI switches on to pick its rejection template:
//   data_missing — fixable: complete the profile fields and retry
//   ineligible   — hard knockout (age, credit, income, model)
//   access       — needs One ID consent
export type RejectReasonCategory = 'data_missing' | 'ineligible' | 'access';

export const REJECT_REASON_CATEGORY: Record<ScoringRejectReasonCode, RejectReasonCategory> = {
  // myid — missing registration fields (fixable)
  address_absent: 'data_missing',
  pinfl_absent: 'data_missing',
  passport_series_absent: 'data_missing',
  passport_number_absent: 'data_missing',
  doc_type_absent: 'data_missing',
  region_absent: 'data_missing',
  district_absent: 'data_missing',
  phone_absent: 'data_missing',
  // myid — business knockout
  age_below: 'ineligible',
  age_above: 'ineligible',
  not_resident_uzbekistan: 'ineligible',
  // katm_claim
  oneid_locked: 'access',
  // katm_mib
  mib_enforcement_found: 'ineligible',
  // katm_077
  credit_ban: 'ineligible',
  has_defaults: 'ineligible',
  judicial_or_decommissioned: 'ineligible',
  has_actual_overdue_debts_from_60_to_90: 'ineligible',
  has_actual_overdue_debts_from_30_to_60: 'ineligible',
  // katm_inps
  no_income: 'ineligible',
  // model stage
  model_stop_factor: 'ineligible',
  zero_limit: 'ineligible',
};

// --- Per-type summary shapes (the up-front admin-card fields) ----------------

export interface MyidSummary {
  age: number | null;
  hasAddress: boolean;
  /** Required registration fields that were absent (empty when complete). */
  missingFields: string[];
}

export interface KatmClaimSummary {
  /** The shared claim id allocated for this run. */
  claimId: string;
  /** KATM-SIR — the bureau's subject identifier (empty if not returned). */
  katmSir: string | null;
}

export interface KatmMibSummary {
  /** Inner report.resultCode (204 = no enforcement found). */
  resultCode: number;
  resultMessage: string;
  /** True only when resultCode is a confirmed PASS code. */
  passed: boolean;
}

export interface Katm077Summary {
  score: number;
  scoringClass: string;
  hasCreditBan: boolean;
  hasDefaults: boolean;
  /** Any contract under judicial collection (lawsuit_principal_sum > 0), all-time. */
  hasJuridical: boolean;
  /** Any written-off / off-balance contract (offbalance_principal_sum > 0), all-time. */
  hasDecommission: boolean;
  maxOverdueDays: number;
  /** Count of 30–60 DPD overdue items on contracts active within the last year. */
  actualOverdue30to60Count: number;
  /** Count of 60–90 DPD overdue items on contracts active within the last 2 years. */
  actualOverdue60to90Count: number;
}

export interface KatmInpsSummary {
  incomesAllSumma: number;
  avgMonthlyIncome: number;
  periodBegin: string;
  periodEnd: string;
}

export interface ModelScoreSummary {
  score: number;
  platformCreditLimit: number;
}

// --- plum_card --------------------------------------------------------------
// Card-behaviour scoring from Plumgate. Discriminated on pcType because the two
// rails are NOT the same measurement:
//   uzcard — template points (DATA-SET) out of a fixed maxScoreBall (e.g. 113/550).
//            Criteria the vendor did not evaluate are absent from `criteria` yet
//            still counted in maxScoreBall, so the ratio can understate.
//   humo   — unbounded million-som buckets (ball N ⇒ turnover in ((N-1)m, N*1m]).
//            No ceiling, no total, no percentage. Never compare to an uzcard ball.
// The fields common to both identify the card and the window the figures cover.
interface PlumCardSummaryBase {
  /** Plumgate's My Uzcard card id — the row's owner. A worker whose job carries a
   *  different cardId is stale (the agent switched cards) and must not write. */
  cardId: string;
  maskedPan: string;
  /** Vendor scoring id — uzcard only; persisted between create and poll. */
  plumScoringId?: number;
  /** ISO — the observation window both rails are measured over. */
  periodBegin: string;
  periodEnd: string;
}

export interface PlumCardUzcardSummary extends PlumCardSummaryBase {
  pcType: 'uzcard';
  scoredBall?: number;
  maxScoreBall?: number;
  criteria?: Array<{ name: string; category: string; ball: number }>;
}

export interface PlumCardHumoSummary extends PlumCardSummaryBase {
  pcType: 'humo';
  totalDebitScore?: number;
  totalDebitCount?: number;
  replenishmentScore?: number;
  replenishmentCount?: number;
  creditScore?: number;
  creditCount?: number;
}

export type PlumCardSummary = PlumCardUzcardSummary | PlumCardHumoSummary;

export type PipelineSummary =
  | MyidSummary
  | KatmClaimSummary
  | KatmMibSummary
  | Katm077Summary
  | KatmInpsSummary
  | PlumCardSummary
  | ModelScoreSummary;

// --- Evaluation result a stop-factor check returns --------------------------

export type PipelineEvaluation =
  | { status: 'passed'; summary: PipelineSummary; raw: unknown }
  | {
      status: 'rejected';
      rejectReasonCode: RejectReasonCode;
      summary: PipelineSummary;
      raw: unknown;
    }
  | { status: 'pending'; summary: PipelineSummary | null; raw: unknown }
  | { status: 'error'; summary?: PipelineSummary | null; raw: unknown };
