// ---------------------------------------------------------------------------
// Scoring model types — mirror the structure in finsuminpsgnk.json
// ---------------------------------------------------------------------------

export interface RangeBand {
  Score: number
  Description?: string
  [from: string]: unknown // IncomeFrom/AgeTo/ExperienceFrom/etc.
}

export interface EnumScores {
  [key: string]: number
}

export interface RangeCriterion {
  ImportantLevel: number
  Enabled?: boolean
  Name?: string
  Values: RangeBand[]
}

export interface EnumCriterion {
  ImportantLevel: number
  Enabled?: boolean
  Name?: string
  Scores: EnumScores
}

export interface PassportDataCriterion {
  ImportantLevel: number
  Enabled?: boolean
  Name?: string
  ValidRegions: string[]
  Score: number
}

export interface LimitSumBand {
  From: number
  To: number
  Score: number // coefficient: 0 | 0.8 | 1.0
}

export interface LimitSumCriterion {
  ImportantLevel: number
  Enabled?: boolean
  Name?: string
  Values: LimitSumBand[]
}

export interface ScoringModelParams {
  IncomeSum: RangeCriterion & { MinAllowedAmount?: number; MaxAllowedAmount?: number }
  Citizenship: EnumCriterion
  WorkExperience: RangeCriterion
  Age: RangeCriterion
  MonthlyAveragePayment: RangeCriterion
  OverduePrincipalDays: RangeCriterion
  ContingentLiability: RangeCriterion
  Overdue30Days: RangeCriterion
  Overdue30To60Days: RangeCriterion
  Overdue60To90Days: RangeCriterion
  Overdue90Days: RangeCriterion
  Juridical: EnumCriterion
  DeCommissioned: EnumCriterion
  LoanApplication: RangeCriterion & { Rejections?: { Code: string }[] }
  Gender: EnumCriterion
  CoBorrowerLiability: RangeCriterion
  GuarantorLiability: RangeCriterion
  PledgerLiability: RangeCriterion
  Mortgage: EnumCriterion
  PassportData: PassportDataCriterion
  AllDebts: RangeCriterion
  LimitSum: LimitSumCriterion
}

// ---------------------------------------------------------------------------
// Input types — all optional; missing inputs are skipped
// ---------------------------------------------------------------------------

export interface ScoringInputs {
  incomeSum?: number                 // BRV units
  workExperienceMonths?: number
  age?: number
  citizenship?: 'Uzbekistan' | 'NonResident'
  gender?: 'Male' | 'Female'
  monthlyPaymentRatio?: number       // % of income (0–100+)
  overduePrincipalContracts?: number // count of contracts: 0=no history, 1=clean, 2+=has overdues
  contingentLiability?: number       // open loan count
  overdue30Count?: number
  overdue30to60Count?: number
  overdue60to90Count?: number
  overdue90Count?: number
  hasJuridical?: boolean
  hasDecommission?: boolean
  loanApplicationCount?: number
  coBorrowerMaxDays?: number | null   // null = no co-borrower
  guarantorMaxDays?: number | null    // null = no guarantor
  pledgerMaxDays?: number | null      // null = no pledger
  hasMortgage?: boolean
  passportRegion?: string
  allDebts?: number                  // UZS
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface CriterionResult {
  key: string
  name: string
  rawScore: number
  importantLevel: number
  weightedScore: number
  skipped: boolean
}

export interface ScoringResult {
  totalScore: number
  coefficient: number // 0 | 0.8 | 1.0
  breakdown: CriterionResult[]
}

// ---------------------------------------------------------------------------
// Range helpers
// ---------------------------------------------------------------------------

function fromKey(band: RangeBand): number {
  for (const k of Object.keys(band)) {
    if (k.toLowerCase().endsWith('from') && k !== 'Score' && k !== 'Description') {
      return band[k] as number
    }
  }
  return -Infinity
}

function toKey(band: RangeBand): number {
  for (const k of Object.keys(band)) {
    if (k.toLowerCase().endsWith('to') && k !== 'Score' && k !== 'Description') {
      return band[k] as number
    }
  }
  return Infinity
}

function matchRange(bands: RangeBand[], value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null
  for (const band of bands) {
    const from = fromKey(band)
    const to = toKey(band)
    if (value >= from && value <= to) return band.Score
  }
  return null
}

function result(
  key: string,
  name: string,
  importantLevel: number,
  rawScore: number | null,
): CriterionResult {
  if (rawScore === null) {
    return { key, name, rawScore: 0, importantLevel, weightedScore: 0, skipped: true }
  }
  return {
    key,
    name,
    rawScore,
    importantLevel,
    weightedScore: rawScore * importantLevel,
    skipped: false,
  }
}

// ---------------------------------------------------------------------------
// Main engine
// ---------------------------------------------------------------------------

export function computeScoringModel(
  params: ScoringModelParams,
  inputs: ScoringInputs,
): ScoringResult {
  const p = params

  const criteria: CriterionResult[] = [
    result(
      'IncomeSum',
      p.IncomeSum.Name ?? 'IncomeSum',
      p.IncomeSum.ImportantLevel,
      matchRange(p.IncomeSum.Values, inputs.incomeSum),
    ),
    result(
      'WorkExperience',
      p.WorkExperience.Name ?? 'WorkExperience',
      p.WorkExperience.ImportantLevel,
      matchRange(p.WorkExperience.Values, inputs.workExperienceMonths),
    ),
    result(
      'Age',
      p.Age.Name ?? 'Age',
      p.Age.ImportantLevel,
      matchRange(p.Age.Values, inputs.age),
    ),
    result(
      'Citizenship',
      p.Citizenship.Name ?? 'Citizenship',
      p.Citizenship.ImportantLevel,
      inputs.citizenship !== undefined ? (p.Citizenship.Scores[inputs.citizenship] ?? null) : null,
    ),
    result(
      'Gender',
      p.Gender.Name ?? 'Gender',
      p.Gender.ImportantLevel,
      inputs.gender !== undefined ? (p.Gender.Scores[inputs.gender] ?? null) : null,
    ),
    result(
      'MonthlyAveragePayment',
      p.MonthlyAveragePayment.Name ?? 'MonthlyAveragePayment',
      p.MonthlyAveragePayment.ImportantLevel,
      matchRange(p.MonthlyAveragePayment.Values, inputs.monthlyPaymentRatio),
    ),
    result(
      'OverduePrincipalDays',
      p.OverduePrincipalDays.Name ?? 'OverduePrincipalDays',
      p.OverduePrincipalDays.ImportantLevel,
      matchRange(p.OverduePrincipalDays.Values, inputs.overduePrincipalContracts),
    ),
    result(
      'ContingentLiability',
      p.ContingentLiability.Name ?? 'ContingentLiability',
      p.ContingentLiability.ImportantLevel,
      matchRange(p.ContingentLiability.Values, inputs.contingentLiability),
    ),
    result(
      'Overdue30Days',
      p.Overdue30Days.Name ?? 'Overdue30Days',
      p.Overdue30Days.ImportantLevel,
      matchRange(p.Overdue30Days.Values, inputs.overdue30Count),
    ),
    result(
      'Overdue30To60Days',
      p.Overdue30To60Days.Name ?? 'Overdue30To60Days',
      p.Overdue30To60Days.ImportantLevel,
      matchRange(p.Overdue30To60Days.Values, inputs.overdue30to60Count),
    ),
    result(
      'Overdue60To90Days',
      p.Overdue60To90Days.Name ?? 'Overdue60To90Days',
      p.Overdue60To90Days.ImportantLevel,
      matchRange(p.Overdue60To90Days.Values, inputs.overdue60to90Count),
    ),
    result(
      'Overdue90Days',
      p.Overdue90Days.Name ?? 'Overdue90Days',
      p.Overdue90Days.ImportantLevel,
      matchRange(p.Overdue90Days.Values, inputs.overdue90Count),
    ),
    result(
      'Juridical',
      p.Juridical.Name ?? 'Juridical',
      p.Juridical.ImportantLevel,
      inputs.hasJuridical !== undefined
        ? (inputs.hasJuridical
            ? (p.Juridical.Scores['WithJuridical'] ?? null)
            : (p.Juridical.Scores['WithoutJuridical'] ?? null))
        : null,
    ),
    result(
      'DeCommissioned',
      p.DeCommissioned.Name ?? 'DeCommissioned',
      p.DeCommissioned.ImportantLevel,
      inputs.hasDecommission !== undefined
        ? (inputs.hasDecommission
            ? (p.DeCommissioned.Scores['WithDecommission'] ?? null)
            : (p.DeCommissioned.Scores['WithoutDecommission'] ?? null))
        : null,
    ),
    result(
      'LoanApplication',
      p.LoanApplication.Name ?? 'LoanApplication',
      p.LoanApplication.ImportantLevel,
      matchRange(p.LoanApplication.Values, inputs.loanApplicationCount),
    ),
    // Co-borrower: null input = no co-borrower (first band has null From/To)
    result(
      'CoBorrowerLiability',
      p.CoBorrowerLiability.Name ?? 'CoBorrowerLiability',
      p.CoBorrowerLiability.ImportantLevel,
      inputs.coBorrowerMaxDays === undefined
        ? null
        : inputs.coBorrowerMaxDays === null
          ? (p.CoBorrowerLiability.Values.find(
              (b) => b.CoBorrowerFrom === null && b.CoBorrowerTo === null,
            )?.Score ?? null)
          : matchRange(p.CoBorrowerLiability.Values, inputs.coBorrowerMaxDays),
    ),
    result(
      'GuarantorLiability',
      p.GuarantorLiability.Name ?? 'GuarantorLiability',
      p.GuarantorLiability.ImportantLevel,
      inputs.guarantorMaxDays === undefined
        ? null
        : inputs.guarantorMaxDays === null
          ? (p.GuarantorLiability.Values.find(
              (b) => b.GuarantorFrom === null && b.GuarantorTo === null,
            )?.Score ?? null)
          : matchRange(p.GuarantorLiability.Values, inputs.guarantorMaxDays),
    ),
    result(
      'PledgerLiability',
      p.PledgerLiability.Name ?? 'PledgerLiability',
      p.PledgerLiability.ImportantLevel,
      inputs.pledgerMaxDays === undefined
        ? null
        : inputs.pledgerMaxDays === null
          ? (p.PledgerLiability.Values.find(
              (b) => b.PledgerFrom === null && b.PledgerTo === null,
            )?.Score ?? null)
          : matchRange(p.PledgerLiability.Values, inputs.pledgerMaxDays),
    ),
    result(
      'Mortgage',
      p.Mortgage.Name ?? 'Mortgage',
      p.Mortgage.ImportantLevel,
      inputs.hasMortgage !== undefined
        ? (inputs.hasMortgage
            ? (p.Mortgage.Scores['WithMortgage'] ?? null)
            : (p.Mortgage.Scores['WithoutMortgage'] ?? null))
        : null,
    ),
    result(
      'PassportData',
      p.PassportData.Name ?? 'PassportData',
      p.PassportData.ImportantLevel,
      inputs.passportRegion !== undefined
        ? (p.PassportData.ValidRegions.includes(inputs.passportRegion)
            ? p.PassportData.Score
            : 0)
        : null,
    ),
    result(
      'AllDebts',
      p.AllDebts.Name ?? 'AllDebts',
      p.AllDebts.ImportantLevel,
      matchRange(p.AllDebts.Values, inputs.allDebts),
    ),
  ]

  // Apply Enabled flag — disabled criteria are treated as skipped (contribute 0)
  const paramsByKey = p as unknown as Record<string, { Enabled?: boolean }>
  const breakdown = criteria.map((c) =>
    paramsByKey[c.key]?.Enabled === false
      ? { ...c, rawScore: 0, weightedScore: 0, skipped: true }
      : c,
  )

  const totalScore = breakdown.reduce((sum, c) => sum + c.weightedScore, 0)

  const coefficientBand = p.LimitSum.Values.find(
    (b) => totalScore >= b.From && totalScore <= b.To,
  )
  const coefficient = coefficientBand?.Score ?? 0

  return { totalScore, coefficient, breakdown }
}
