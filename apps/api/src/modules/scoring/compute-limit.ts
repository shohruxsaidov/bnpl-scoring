// ---------------------------------------------------------------------------
// Shared credit-limit computation — the single source of truth for turning a
// resolved model + KATM/INPS/user data into a score, decision and per-month
// credit limit (whole som) plus the criteria_scores breakdown.
//
// Both the merchant wizard (POST /:id/cards/score) and the client self-scoring
// path (the KATM poller's client completion) call this so the credit formula
// can never drift between the two. Pure/compute-only: callers own persistence
// (recordPipeline / markScored / stampScoring / user_credit_limits).
// ---------------------------------------------------------------------------
import type { katm077Reports } from '@db/katm-077-reports';
import type { katmInpsReports } from '@db/katm-inps-reports';
import { deriveKatm2yInputs } from '../integrations/katm/service/shared';
import type { GENDERS, InpsIncomeEntry } from '../integrations/katm/service/shared';
import {
  computeScoringModel,
  type ScoringInputs,
  type ScoringModelData,
  type ScoringResult,
} from './engine';
import type { CriteriaScores } from './criteria-scores';

type RejectedResult = Extract<ScoringResult, { rejected: true }>;
type PassedResult = Extract<ScoringResult, { rejected: false }>;

export const BRV_UZS = 340_000;

// Credit-limit index by total scoring score (Балл). Half-open [From, To): From
// inclusive, To exclusive. The index scales the applicant's monthly disposable
// income (Income*50% − existing monthly payments) into a per-month credit limit.
// Hardcoded for now — the score→index mapping is not yet model-configurable.
const CREDIT_LIMIT_INDEX_BANDS: ReadonlyArray<{ from: number; to: number; index: number }> = [
  { from: -847, to: 490, index: 0 },
  { from: 490, to: 556, index: 0.25 },
  { from: 556, to: 621, index: 0.5 },
  { from: 621, to: 687, index: 0.75 },
  { from: 687, to: 1000, index: 1 },
];

export function creditLimitIndexForScore(score: number): number {
  const band = CREDIT_LIMIT_INDEX_BANDS.find((b) => score >= b.from && score < b.to);
  return band?.index ?? 0;
}

/** Whole years between an ISO birth date and now. */
export function ageYears(birthDate: string): number {
  const b = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

// INPS reports the income window as "YYYYMM" period bounds; derive its span in months.
export function monthsBetween(begin: string, end: string): number {
  const parse = (s: string): { y: number; m: number } | null => {
    const t = (s ?? '').trim();
    const ym = /^(\d{4})[-/]?(\d{2})/.exec(t); // YYYYMM | YYYY-MM | YYYY/MM | YYYY-MM-DD
    if (!ym) return null;
    return { y: Number(ym[1]), m: Number(ym[2]) };
  };
  const b = parse(begin);
  const e = parse(end);
  if (!b || !e) return 0;
  const months = (e.y - b.y) * 12 + (e.m - b.m) + 1; // inclusive of both endpoints
  return months > 0 ? months : 0;
}

type Katm077Row = typeof katm077Reports.$inferSelect;
type KatmInpsRow = typeof katmInpsReports.$inferSelect;

export interface LimitUserRow {
  birthDate: string | null;
  gender: number | null;
  nationality: string | null;
  citizenship: string | null;
  region: string | null;
  address: string | null;
}

export interface LimitCard {
  pcType: 'uzcard' | 'humo';
  bank: string;
  maskedPan: string;
  holderName: string | null;
}

export interface LimitComputationInput {
  model: ScoringModelData;
  userRow: LimitUserRow | null;
  katm: Katm077Row | null;
  inps: KatmInpsRow | null;
  card: LimitCard | null;
}

export interface LimitComputationResult {
  scoreSum: number;
  coefficient: number;
  /** 'approve' | 'reject' — reject on a model stop-factor or a zero limit. */
  decision: 'approve' | 'reject';
  /** Per-month credit limit in whole som. 0 on any rejection. */
  platformCreditLimit: number;
  criteriaScores: CriteriaScores;
  /** True when the engine itself rejected (stop-factor), vs a zero-limit reject. */
  engineRejected: boolean;
  /** Raw engine output — stored as the model_score pipeline's raw payload. */
  engineResult: ReturnType<typeof computeScoringModel>;
}

/**
 * Run the resolved model over the KATM/INPS/user data and derive the per-month
 * credit limit. Mirrors the merchant wizard's original inline computation.
 */
export function runModelAndLimit(input: LimitComputationInput): LimitComputationResult {
  const { model, userRow, katm, inps, card } = input;

  // KATM inputs are restricted to the last 2 years: re-derived live from the raw
  // 077 detail records (stored aggregates roll up the whole history).
  const katmCutoff = new Date();
  katmCutoff.setFullYear(katmCutoff.getFullYear() - 2);

  const scoringInputs: ScoringInputs = {
    ...(katm && deriveKatm2yInputs(katm.raw, katmCutoff)),
    ...(katm && {
      hasJuridical: katm.hasJuridical ?? false,
      hasDecommission: katm.hasDecommission ?? false,
      pledgerMaxDays: katm.pledgerLiability ?? null,
      guarantorMaxDays: 0,
      coBorrowerMaxDays: 0,
    }),
    ...(userRow && {
      age: userRow.birthDate ? ageYears(userRow.birthDate) : undefined,
      gender: userRow.gender as GENDERS,
      citizenship: userRow.citizenship || '',
      passportRegion: userRow.region || '',
      address: userRow.address || '',
    }),
    ...(inps && {
      incomeSum: (inps.incomesAllSumma ?? 0) / 12,
      incomeSumInBrv: (inps.incomesAllSumma ?? 0) / 12 / BRV_UZS,
      workExperienceMonths: monthsBetween(inps.periodBegin ?? '', inps.periodEnd ?? ''),
    }),
    allDebts: 0,
  };

  const engineResult = computeScoringModel(model, scoringInputs);

  let coefficient: number;
  let scoreSum: number;
  let modelEntry: Record<string, unknown>;
  if (engineResult.rejected) {
    const r = engineResult as RejectedResult;
    coefficient = 0;
    scoreSum = 0;
    modelEntry = { rejected: true, stopFactor: r.stopFactor, name: r.name };
  } else {
    const r = engineResult as PassedResult;
    coefficient = r.coefficient;
    scoreSum = r.totalScore;
    modelEntry = {
      rejected: false,
      totalScore: r.totalScore,
      coefficient: r.coefficient,
      breakdown: r.breakdown,
    };
  }

  // Credit limit = monthly disposable income scaled by the score-based index.
  // Per-month figure in whole som. Negative disposable or index 0 → 0, which
  // flows through the zero_limit reject path.
  const incomeMonthly = (inps?.incomesAllSumma ?? 0) / 12;
  const monthlyPayment = katm?.avgMonthlyPayment ? +katm.avgMonthlyPayment / 100 : 0;
  const limitIndex = creditLimitIndexForScore(scoreSum);
  const disposableMonthly = incomeMonthly * 0.5 - monthlyPayment;
  const platformCreditLimit = Math.max(0, Math.round(disposableMonthly * limitIndex));
  const decision: 'approve' | 'reject' =
    engineResult.rejected || platformCreditLimit === 0 ? 'reject' : 'approve';

  const criteriaScores: CriteriaScores = {
    ...(katm && {
      katm: {
        katmScore: katm.score ?? 0,
        detail: {
          katmScore: katm.score ?? 0,
          katmClass: katm.scoringClass ?? '',
          scoringLevel: katm.scoringLevel ?? '',
          openCredits: katm.activeLoans ?? 0,
          totalDebt: katm.allDebtSum ?? 0,
          overdueInOpenCredits: katm.overdueAmount ?? 0,
          totalContracts: katm.totalContracts ?? 0,
          totalClaims: katm.totalClaims ?? 0,
          overdueCount: katm.overdueCount ?? 0,
          maxOverdueDays: katm.maxOverdueDays ?? 0,
          maxOverdueSum: katm.overdueAmount ?? 0,
          avgMonthlyPayment: katm.avgMonthlyPayment ?? 0,
          hasCreditBan: katm.hasCreditBan ?? false,
        },
      },
    }),
    ...(card && {
      card: {
        detail: {
          pcType: card.pcType,
          bank: card.bank,
          maskedPan: card.maskedPan,
          holderName: card.holderName ?? undefined,
        },
      },
    }),
    ...(userRow && {
      client: {
        detail: {
          birthDate: userRow.birthDate ?? '',
          gender: String(userRow.gender),
          nationality: userRow.nationality ?? '',
        },
      },
    }),
    ...(inps && {
      inps: {
        detail: {
          incomesAllSumma: inps.incomesAllSumma ?? 0,
          avgMonthlyIncome: (inps.incomesAllSumma ?? 0) / 12,
          periodBegin: inps.periodBegin ?? '',
          periodEnd: inps.periodEnd ?? '',
          incomes: (inps.incomes as InpsIncomeEntry[]) ?? [],
        },
      },
    }),
    model: modelEntry,
  };

  return {
    scoreSum,
    coefficient,
    decision,
    platformCreditLimit,
    criteriaScores,
    engineRejected: engineResult.rejected,
    engineResult,
  };
}
