// ---------------------------------------------------------------------------
// Scoring model types — mirror finsuminpsgnk.json v2 structure
// ---------------------------------------------------------------------------

export interface RangeBand {
  From: number
  To: number | null
  Score: number
  Description?: string
}

export interface CategoryEntry {
  Score: number
  Description?: string
}

export interface NotApplicableEntry {
  Score: number
  Description?: string
}

export interface RangeParam {
  Name: string
  Enabled: boolean
  ImportantLevel: number
  Type: 'range'
  Unit?: string | null
  DefaultScore: number
  NotApplicable?: NotApplicableEntry
  Ranges: RangeBand[]
}

export interface CategoricalParam {
  Name: string
  Enabled: boolean
  ImportantLevel: number
  Type: 'categorical'
  DefaultScore: number
  Categories: Record<string, CategoryEntry>
}

export interface RegionMatchParam {
  Name: string
  Enabled: boolean
  ImportantLevel: number
  Type: 'regionMatch'
  DefaultScore: number
  ValidRegions: string[]
  MatchScore: number
}

export type ScoringParam = RangeParam | CategoricalParam | RegionMatchParam

export interface StopFactor {
  Name: string
  Type: 'boolean'
  Match: string
  Reject: boolean
  Description?: string
}

export interface CoefficientBand {
  From: number
  To: number | null
  Coefficient: number
}

export interface LimitCoefficient {
  Name?: string
  Description?: string
  Unit?: string
  BaseLimit?: number   // base amount in soms, scaled by the resolved coefficient
  DefaultCoefficient: number
  Ranges: CoefficientBand[]
}

export interface ScoringModelData {
  StopFactors?: Record<string, StopFactor>
  ScoringParams: Record<string, ScoringParam>
  LimitCoefficient: LimitCoefficient
}

// ---------------------------------------------------------------------------
// Input types — all optional; missing inputs are skipped
// ---------------------------------------------------------------------------

export interface ScoringInputs {
  incomeSum?: number
  workExperienceMonths?: number
  age?: number
  citizenship?: 'Uzbekistan' | 'NonResident'
  gender?: 'Male' | 'Female'
  monthlyPayment?: number
  creditHistoryContracts?: number    // count: 0=no history, 1=clean, 2+=has overdues
  contingentLiability?: number       // open loan count
  overdue30Count?: number
  overdue30to60Count?: number
  overdue60to90Count?: number
  overdue90Count?: number
  hasJuridical?: boolean
  hasDecommission?: boolean
  loanApplicationCount?: number
  coBorrowerMaxDays?: number | null  // null = not a co-borrower
  guarantorMaxDays?: number | null   // null = not a guarantor
  pledgerMaxDays?: number | null     // null = not a pledger
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

export type ScoringResult =
  | { rejected: true; stopFactor: string; name: string }
  | { rejected: false; totalScore: number; coefficient: number; breakdown: CriterionResult[] }

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Half-open [From, To): From inclusive, To exclusive. To=null means unbounded.
function matchRange(bands: RangeBand[], value: number): number | null {
  for (const band of bands) {
    if (value >= band.From && (band.To === null || value < band.To)) {
      return band.Score
    }
  }
  return null
}

function scoreRangeParam(param: RangeParam, value: number | null | undefined): number | null {
  if (value === undefined) return null
  if (value === null) return param.NotApplicable?.Score ?? null
  return matchRange(param.Ranges, value)
}

// ---------------------------------------------------------------------------
// Main engine
// ---------------------------------------------------------------------------

export function computeScoringModel(
  model: ScoringModelData,
  inputs: ScoringInputs,
): ScoringResult {
  // Stop factors — checked before any scoring
  const stopMatchInputs: Record<string, boolean | undefined> = {
    WithJuridical:    inputs.hasJuridical,
    WithDecommission: inputs.hasDecommission,
  }

  for (const [key, factor] of Object.entries(model.StopFactors ?? {})) {
    if (factor.Reject && stopMatchInputs[factor.Match] === true) {
      return { rejected: true, stopFactor: key, name: factor.Name }
    }
  }

  // Map param keys to their raw input values
  const rangeInputs: Record<string, number | null | undefined> = {
    IncomeSum:               inputs.incomeSum,
    WorkExperience:          inputs.workExperienceMonths,
    Age:                     inputs.age,
    MonthlyAveragePayment:   inputs.monthlyPayment,
    CreditHistoryContracts:  inputs.creditHistoryContracts,
    ContingentLiability:     inputs.contingentLiability,
    Overdue30Days:           inputs.overdue30Count,
    Overdue30To60Days:       inputs.overdue30to60Count,
    Overdue60To90Days:       inputs.overdue60to90Count,
    Overdue90Days:           inputs.overdue90Count,
    LoanApplication:         inputs.loanApplicationCount,
    CoBorrowerLiability:     inputs.coBorrowerMaxDays,
    GuarantorLiability:      inputs.guarantorMaxDays,
    PledgerLiability:        inputs.pledgerMaxDays,
    AllDebts:                inputs.allDebts,
  }

  const categoricalInputs: Record<string, string | undefined> = {
    Citizenship: inputs.citizenship,
    Gender:      inputs.gender,
    Mortgage:    inputs.hasMortgage !== undefined
      ? (inputs.hasMortgage ? 'WithMortgage' : 'WithoutMortgage')
      : undefined,
  }

  const regionInputs: Record<string, string | undefined> = {
    PassportData: inputs.passportRegion,
  }

  const breakdown: CriterionResult[] = []

  for (const [key, param] of Object.entries(model.ScoringParams)) {
    let rawScore: number | null = null

    if (param.Type === 'range') {
      rawScore = scoreRangeParam(param, rangeInputs[key])
    } else if (param.Type === 'categorical') {
      const catKey = categoricalInputs[key]
      rawScore = catKey !== undefined ? (param.Categories[catKey]?.Score ?? null) : null
    } else if (param.Type === 'regionMatch') {
      const region = regionInputs[key]
      rawScore = region !== undefined
        ? (param.ValidRegions.includes(region) ? param.MatchScore : 0)
        : null
    }

    const skipped = !param.Enabled || rawScore === null
    breakdown.push({
      key,
      name: param.Name,
      rawScore: skipped ? 0 : rawScore!,
      importantLevel: param.ImportantLevel,
      weightedScore: skipped ? 0 : rawScore! * param.ImportantLevel,
      skipped,
    })
  }

  const totalScore = breakdown.reduce((sum, c) => sum + c.weightedScore, 0)

  const lc = model.LimitCoefficient
  const band = lc.Ranges.find(
    (b) => totalScore >= b.From && (b.To === null || totalScore < b.To),
  )
  const coefficient = band?.Coefficient ?? lc.DefaultCoefficient

  return { rejected: false, totalScore, coefficient, breakdown }
}
