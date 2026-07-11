// ---------------------------------------------------------------------------
// Configurable pipeline catalog.
//
// Two independent layers decide whether a pipeline runs, AND-ed together:
//   1. the global ops kill-switch — scoring_pipeline_settings (this catalog)
//   2. the per-model policy       — the `Pipelines` key on a model revision
//
// Layer 1 answers "may we call this vendor at all" (integration down, no
// contract). Layer 2 answers "does this model's score depend on that data".
// A model that declares a pipeline the ops layer has switched off cannot run:
// the scoring run errors rather than scoring against a mutilated input vector.
//
// Only the pipelines below are configurable. katm_claim is infrastructure (it
// registers the claimId the three KATM reports share) and model_score is the
// terminal stage; neither is an admin decision.
// ---------------------------------------------------------------------------

export const CONFIGURABLE_PIPELINES = ['myid', 'katm_mib', 'katm_077', 'katm_inps'] as const;

export type ConfigurablePipeline = (typeof CONFIGURABLE_PIPELINES)[number];

export function isConfigurablePipeline(value: string): value is ConfigurablePipeline {
  return (CONFIGURABLE_PIPELINES as readonly string[]).includes(value);
}

// Defaults are today's runtime behaviour, deliberately NOT "everything on":
// flow.ts never calls MIB, and MIB_REJECT_CODES is empty, so a MIB response
// other than 204 routes to `error` and fails the run. A pipeline with no row in
// scoring_pipeline_settings falls back to its default here — which is why the
// table needs no seed migration, and why adding a pipeline needs no schema
// change.
export const DEFAULT_PIPELINE_ENABLED: Record<ConfigurablePipeline, boolean> = {
  myid: true,
  katm_mib: false,
  katm_077: true,
  katm_inps: true,
};

// The scoring params each pipeline supplies. engine.ts scores a param whose
// input is missing as 0 (not as a neutral default), so disabling a pipeline
// strands its params and lowers the max achievable score. This map is what lets
// the model editor recompute that ceiling and refuse a model whose top
// coefficient band became unreachable.
//
// MonthlyAveragePayment is the credit-load-to-income ratio and so appears under
// BOTH katm_077 and katm_inps — it needs either source to be scorable.
export const PIPELINE_SCORING_PARAMS: Record<ConfigurablePipeline, readonly string[]> = {
  // Pure gate. Knocks out on address/age against the `users` row we already
  // hold; it fetches nothing. Age, gender, citizenship and region reach the
  // engine from `users` whether or not this pipeline runs, so disabling it
  // costs zero score — it only removes the three knockouts.
  myid: [],
  // Pure gate today. The AllDebts param would draw from MIB, but compute-limit
  // hardcodes `allDebts: 0`, so MIB feeds no param at present.
  katm_mib: [],
  katm_077: [
    'MonthlyAveragePayment',
    'CreditHistoryContracts',
    'ContingentLiability',
    'Overdue30Days',
    'Overdue30To60Days',
    'Overdue60To90Days',
    'Overdue90Days',
    'LoanApplication',
    'CoBorrowerLiability',
    'GuarantorLiability',
    'PledgerLiability',
    // Mortgage is mapped here for completeness; compute-limit never assigns
    // hasMortgage, so the param is skipped on every run regardless.
    'Mortgage',
  ],
  // Income also feeds the credit-limit formula itself, not only these params.
  katm_inps: ['IncomeSum', 'WorkExperience', 'MonthlyAveragePayment'],
};

// The model StopFactors (keyed by their `Match` value) each pipeline supplies.
// engine.ts tests `input === true`, so a missing input silently fails OPEN — a
// model that kept a 077 stop-factor while disabling 077 would stop rejecting
// judicially-encumbered applicants. The model editor uses this map to block
// that combination outright.
export const PIPELINE_STOP_FACTORS: Record<ConfigurablePipeline, readonly string[]> = {
  myid: [],
  katm_mib: [],
  katm_077: ['WithJuridical', 'WithDecommission'],
  katm_inps: [],
};

// Pipelines whose data the credit-limit formula itself consumes, beyond any
// scoring param. Disabling one of these is what forces a model to re-author its
// LimitCoefficient (and BaseLimit) rather than merely losing a few points.
export const PIPELINE_FEEDS_LIMIT: Record<ConfigurablePipeline, boolean> = {
  myid: false,
  katm_mib: false,
  katm_077: false,
  katm_inps: true,
};
