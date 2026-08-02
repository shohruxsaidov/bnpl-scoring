// ---------------------------------------------------------------------------
// Domain types — Credit Scoring & POS Lending Platform
// ---------------------------------------------------------------------------

export type EmployeeRole = 'agent' | 'merchant_admin';

export type BailsmanRelation = 'father' | 'mother' | 'brother' | 'friend' | 'other';

export interface Bailsman {
  relation: BailsmanRelation;
  phone: string;
}

export interface Tenant {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  fullName: string;
  phone: string;
  merchantId: string;
  branchId: string;
  roles: EmployeeRole[];
  mustChangePassword: boolean;
  active: boolean;
  createdAt: string;
}

export interface Region {
  id: number;
  upperId: number | null;
  nameRu: string;
  nameUz: string;
  nameUzc: string;
}

export interface Branch {
  id: string;
  merchantId: string;
  name: string;
  address: string;
  phone: string;
  regionId: number | null;
  active: boolean;
  createdAt: string;
}

export type DealStatus =
  | 'draft'
  | 'scoring'
  | 'approved'
  | 'declined'
  | 'active'
  | 'closed'
  | 'overdue';

export type ScoreDecision = 'approved' | 'declined' | 'manual_review';

export interface Client {
  id: string;
  pinfl: string;
  firstName: string;
  lastName: string;
  phone: string;
  birthDate: string;
  gender: string;
  nationality: string;
  passportSeries: string | null;
  passportNumber: string | null;
  photoUrl: string | null;
  // KATM claim registration fields (ADR-0025)
  address?: string | null;
  katmRegionCode?: string | null;
  katmDistrictCode?: string | null;
  docType?: number | null;
  /**
   * The client's standing reuse-eligible limit (reuse scoring), or null when
   * they must be scored from scratch. Preview only — `/start` is the authority
   * and can still reject, e.g. if the client opened a deal elsewhere meanwhile.
   */
  reusableLimit?: { creditLimit: number; expiresAt: string } | null;
}

export interface Card {
  /** PlumGate userCardId — required for scoring and payment calls */
  id: string;
  /** PlumGate userCardId (same value as id, explicit alias for clarity) */
  plumCardId: string;
  /** Payment rail, as the vendor numbers it: 0 uzcard, 1 humo. Never the rail's
   *  name — the API has always sent the number. Absent on cards from
   *  GET /:id/cards, which returns only `id` and `maskedPan`. */
  pcType?: number;
  maskedPan: string;
  holderName: string;
  expiry: string;
  bank: string;
}

export interface Tariff {
  id: string;
  name: string;
  termMonths: number;
  /** Ustama — markup percent */
  markupPercent: number;
  /** Credit Range bounds in som; null = unbounded */
  minAmount: number | null;
  maxAmount: number | null;
  active: boolean;
}

/** One tariff's repayment preview from the Tariff Calculator quote endpoint. All amounts in som. */
export interface TariffQuote {
  tariffId: string;
  name: string;
  termMonths: number;
  markupPercent: number;
  minAmount: number | null;
  maxAmount: number | null;
  inRange: boolean;
  totalPayable: number;
  ustamaAmount: number;
  monthlyAmount: number;
  lastMonthlyAmount: number;
  installments: number[];
}

export interface Category {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
}

export interface Product {
  id: string;
  merchantId: string;
  categoryId: string;
  name: string;
  /** Decimal string e.g. "1500000.00" — UZS */
  price: string;
  mxikCode: string | null;
  packageCode: number | null;
  packageName: string | null;
  isLabeled: boolean;
  active: boolean;
  createdAt: string;
}

export interface BasketItem {
  product: Product;
  quantity: number;
  /** Per-unit marking codes for labeled products; [] for unlabeled. length === quantity when labeled. */
  labels: string[];
}

/** Matches deal_payment_schedules table. Renamed from ScheduleRow. */
export interface DealPaymentSchedule {
  index: number;
  /** ISO date string — matches deal_payment_schedules.due_date */
  dueDate: string;
  /** som */
  amount: number;
  paid: boolean;
  paidAt: string | null;
}

export interface Deal {
  id: string;
  clientName: string;
  clientPinfl: string;
  clientPhone: string;
  status: DealStatus;
  tariffId: string;
  tariffName: string;
  termMonths: number;
  /** sum of price × quantity across all DealItems, som */
  amount: number;
  /** amount + Ustama, som */
  totalPayable: number;
  /** from joined client_scorings.score_sum — included in API response */
  score: number;
  /** from joined client_scorings.decision — included in API response */
  decision: ScoreDecision;
  agentId: string;
  createdAt: string;
  paymentDay: number;
  basket: BasketItem[];
}

/** Raw Card Score result from PlumGate — used transiently in the deal creation flow. */
export interface CardScoreResult {
  score: number;
  decision: ScoreDecision;
  limit: number;
}

/** Full scoring result stored in client_scorings — exposed by the clientScoring store. */
export interface ClientScoringResult {
  scoringId: string;
  scoreSum: number;
  coefficient: number;
  decision: ScoreDecision;
  platformCreditLimit: number;
  criteriaScores: Record<string, unknown>;
}
