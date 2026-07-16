// ---------------------------------------------------------------------------
// criteria_scores shape
// The per-criterion breakdown produced by the scoring computation and stamped
// onto a deal session's step_data (and returned to the wizard UI). Previously
// co-located with the scoring_histories table; kept here on the computation
// side now that persistence is being rebuilt from scratch.
// ---------------------------------------------------------------------------
import type { InpsIncomeEntry } from '../integrations/katm/service/shared';

export interface KatmCriteriaDetail {
  katmScore: number;
  katmClass: string;
  scoringLevel: string;
  openCredits: number;
  totalDebt: number;
  overdueInOpenCredits: number;
  totalContracts: number;
  totalClaims: number;
  overdueCount: number;
  maxOverdueDays: number;
  maxOverdueSum: number;
  avgMonthlyPayment: number;
  hasCreditBan: boolean;
}

export interface CardCriteriaDetail {
  pcType: string;
  bank?: string;
  maskedPan?: string;
  holderName?: string;
}

export interface ClientCriteriaDetail {
  birthDate: string;
  gender: string;
  nationality: string;
}

export interface InpsCriteriaDetail {
  incomesAllSumma: number;
  avgMonthlyIncome: number;
  periodBegin: string;
  periodEnd: string;
  incomes: InpsIncomeEntry[];
}

export interface CriteriaScores {
  katm?: { katmScore: number; detail: KatmCriteriaDetail };
  card?: { detail: CardCriteriaDetail };
  client?: { detail: ClientCriteriaDetail };
  inps?: { detail: InpsCriteriaDetail };
  model?: Record<string, unknown>;
}
