export interface CreateDealInput {
  merchantId: number;
  branchId: number;
  agentId: number;
  userId: number;
  tariffId: number;
  dealSessionId: string | null;
  basket: Array<{
    productId: number;
    productName: string;
    price: string;
    mxikCode: string | null;
    packageCode: number | null;
    packageName: string | null;
    quantity: number;
  }>;
  paymentDay: number;
  amount: number;
  totalPayable: number;
  termMonths: number;
  markupPercent: number;
  scoreSum: number | null;
  scoringDecision: string | null;
  coefficient?: number | null;
  platformCreditLimit?: number | null;
  criteriaScores?: Record<string, unknown> | null;
  scoringId?: number | null;
  lang: 'ru' | 'uz';
  // KATM audit trail copied from the Deal Session (ADR-0024)
  consentId?: string | null;
  consentDate?: string | null;
  demandId?: string | null;
  infoscoreRaw?: unknown;
  // Avansoviy to'lov — null means no prepayment (ADR-0026)
  prepaymentAmount?: number | null;
}
