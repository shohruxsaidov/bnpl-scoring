export interface CreateScoringInput {
  merchantId: number;
  userId: number;
  scoreSum: number | null;
  coefficient: number | null;
  decision: string;
  platformCreditLimit: number;
  criteriaScores: Record<string, unknown> | null;
}
