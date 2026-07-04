// Data-source provenance per scoring-criterion key. Intrinsic to the key — a
// criterion is always sourced from the same integration regardless of model or
// revision — so it lives here as a static map rather than in the mutable
// per-revision params blob. Consumed by the model detail page and the scoring
// result breakdown to badge each criterion with its origin.
//
// The returned code maps to an i18n string under `scoringModel.source.<code>`;
// callers resolve it through their own `t()` so labels stay localized.

const SOURCE_BY_KEY: Record<string, string> = {
  IncomeSum: 'katm_inps',
  WorkExperience: 'katm_inps',
  Citizenship: 'myid',
  Age: 'myid',
  Gender: 'myid',
  PassportData: 'myid',
  MonthlyAveragePayment: 'katm_077',
  CreditHistoryContracts: 'katm_077',
  ContingentLiability: 'katm_077',
  Overdue30Days: 'katm_077',
  Overdue30To60Days: 'katm_077',
  Overdue60To90Days: 'katm_077',
  Overdue90Days: 'katm_077',
  LoanApplication: 'katm_077',
  CoBorrowerLiability: 'katm_077',
  GuarantorLiability: 'katm_077',
  PledgerLiability: 'katm_077',
  Mortgage: 'katm_077',
  AllDebts: 'katm_mib',
}

/** The source code for a criterion key, or null if the key has no mapped source. */
export function sourceCode(key: string): string | null {
  return SOURCE_BY_KEY[key] ?? null
}

// Display order for grouping criteria by source. Keys not listed (and criteria
// with no mapped source) sort last, preserving their original relative order.
const SOURCE_ORDER: Record<string, number> = {
  myid: 0,
  katm_mib: 1,
  katm_077: 2,
  katm_inps: 3,
}

/** Sort rank for a criterion key by its source; unmapped keys sort last. */
export function sourceRank(key: string): number {
  const code = sourceCode(key)
  return code && code in SOURCE_ORDER ? SOURCE_ORDER[code]! : Number.MAX_SAFE_INTEGER
}
