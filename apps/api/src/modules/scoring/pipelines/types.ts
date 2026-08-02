// ---------------------------------------------------------------------------
// Scoring pipeline domain types
// The ordered, cost-ascending knockout pipelines a scoring run walks before the
// numeric model is allowed to run. All stop-factors are hardcoded here, not
// configurable. See the scorings / scoring_pipelines tables.
// ---------------------------------------------------------------------------

// Ordered cost-ascending: cheap/free checks first so a knockout short-circuits
// before any chargeable bureau call.
// active_deal leads because it is the cheapest of all — one indexed read of our
// own deals table — and because it is the one gate that says nothing about the
// applicant's creditworthiness: they simply already hold the single deal a
// client is allowed (see modules/deals/blocking.ts).
// plum_card sits with the data-gathering stages, before the model verdict, even
// though it resolves asynchronously alongside/after it. It is OBSERVATIONAL: it
// has no stop-factors, feeds no model param, and never rejects — see config.ts.
export const PIPELINE_ORDER = [
  'active_deal',
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
  // active_deal — the client already holds their one open deal
  | 'active_deal_exists'
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
  // active_deal — nothing is wrong with the applicant; they are simply out of
  // slots until the deal they already hold is closed.
  active_deal_exists: 'ineligible',
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

// Can the applicant clear this reason themselves and score again straight away?
//
// A DURABLE rejection earns a cooldown: the client path stores a 0 limit under
// the usual 7-day TTL so a declined applicant cannot re-burn chargeable KATM by
// hammering the button (client/scoring/finalize.ts). Nothing about a credit ban
// or a date of birth changes overnight, so the week costs them nothing.
//
// A RETRYABLE rejection must NOT: its cause is one the applicant can go and fix
// — fill in the missing field, unlock their One ID, close their open deal — and
// a cooldown would lock them out for the rest of the week after they had. They
// also all knock out at a FREE stage, before a single chargeable call, so there
// is no spend for a cooldown to protect in the first place. Retryable reasons
// therefore skip both the 0-limit write and the rejection push.
//
// Independent of RejectReasonCategory on purpose: that axis is about what the UI
// says, this one is about what the backend stores. They happen to agree today.
export const REJECT_REASON_RETRYABLE: Record<ScoringRejectReasonCode, boolean> = {
  // active_deal — clears the day the deal closes
  active_deal_exists: true,
  // myid — the applicant completes their profile
  address_absent: true,
  pinfl_absent: true,
  passport_series_absent: true,
  passport_number_absent: true,
  doc_type_absent: true,
  region_absent: true,
  district_absent: true,
  phone_absent: true,
  // katm_claim — the applicant unlocks their One ID
  oneid_locked: true,
  // Hard knockouts — the cooldown is the point.
  age_below: false,
  age_above: false,
  not_resident_uzbekistan: false,
  mib_enforcement_found: false,
  credit_ban: false,
  has_defaults: false,
  judicial_or_decommissioned: false,
  has_actual_overdue_debts_from_60_to_90: false,
  has_actual_overdue_debts_from_30_to_60: false,
  no_income: false,
  model_stop_factor: false,
  zero_limit: false,
};

export function isRetryableRejectReason(code: string): boolean {
  return REJECT_REASON_RETRYABLE[code as ScoringRejectReasonCode] === true;
}

// --- Per-type summary shapes (the up-front admin-card fields) ----------------

export interface ActiveDealSummary {
  hasActiveDeal: boolean;
  /** The deal holding the slot — null when the stage passed. */
  blockingDealNumber: number | null;
}

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
  /** Vendor scoring id — uzcard only; persisted between create and poll. */
  plumScoringId?: number;
  /** ISO — the observation window both rails are measured over. */
  periodBegin: string;
  periodEnd: string;
  /** Set when this row was COPIED from a recent scoring of the same card rather
   *  than bought fresh (Plum bills per scoring). The figures are as of the
   *  periodBegin/periodEnd above — which lag today by the age of the reuse — so
   *  the provenance is stamped rather than passed off as current. */
  reusedFromScoringId?: number;
  pcType: 0 | 1;
  /** Monthly average turnover over the window, in SOM, as a BAND — both rails
   *  report a bucket index rather than a figure, so only the bracket is real and
   *  a point figure would be an invention. An unset ceiling means the band is
   *  open-ended above (uzcard's top bucket, 90 млн +); humo buckets always close. */
  minAvgAmount?: number;
  maxAvgAmount?: number;
}

export interface PlumCardUzcardSummary extends PlumCardSummaryBase {
  pcType: 0;
  scoredBall?: number;
  maxScoreBall?: number;
  criteria?: Array<{ name: string; category: string; ball: number }>;
}

export interface PlumCardHumoSummary extends PlumCardSummaryBase {
  pcType: 1;
  /** Which series the turnover band above was read off. 'replenishment' is money
   *  coming IN — the signal we actually want; 'debit' is spending, a much weaker
   *  proxy used only when the card reports no inflow at all. Unset means neither
   *  series had any turnover. Recorded because a debit-derived band must not be
   *  read as income. */
  turnoverBasis?: 'replenishment' | 'debit';
  totalDebitScore?: number;
  totalDebitCount?: number;
  replenishmentScore?: number;
  replenishmentCount?: number;
  creditScore?: number;
  creditCount?: number;
}

export type PlumCardSummary = PlumCardUzcardSummary | PlumCardHumoSummary;

export type PipelineSummary =
  | ActiveDealSummary
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
