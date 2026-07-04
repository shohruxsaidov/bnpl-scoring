// ---------------------------------------------------------------------------
// Scoring pipeline domain types
// The ordered, cost-ascending knockout pipelines a scoring run walks before the
// numeric model is allowed to run. All stop-factors are hardcoded here, not
// configurable. See the scorings / scoring_pipelines tables.
// ---------------------------------------------------------------------------

// Ordered cost-ascending: cheap/free checks first so a knockout short-circuits
// before any chargeable bureau call.
export const PIPELINE_ORDER = [
  'myid',
  'katm_claim',
  'katm_mib',
  'katm_077',
  'katm_inps',
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

export type PipelineSummary =
  | MyidSummary
  | KatmClaimSummary
  | KatmMibSummary
  | Katm077Summary
  | KatmInpsSummary
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
