import type { dealSessions } from '../../deals/schema';

export type BailsmanRelation = 'father' | 'mother' | 'brother' | 'friend' | 'other';

export interface BailsmanItem {
  relation: BailsmanRelation;
  phone: string;
}

export const WIZARD_STEPS = [
  'client',
  'card',
  'tariff',
  'products',
  'payment',
  'verification',
] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];

export function isWizardStep(s: string): s is WizardStep {
  return (WIZARD_STEPS as readonly string[]).includes(s);
}

/** Scoring result stamped by the server at /merchant/cards/score. */
export interface ScoringStamp {
  cardId: string;
  /** scoring_histories.id as string */
  scoringId: string | null;
  scoreSum: number;
  coefficient: number;
  decision: string;
  /** som (whole units) */
  platformCreditLimit: number;
  criteriaScores: Record<string, unknown>;
}

/** Async-report state while a BullMQ job polls KATM (ADR-0025). */
export interface KatmPendingState {
  status: 'pending' | 'failed';
  startedAt: string;
  error?: string;
}

/** Prepayment confirmed server-side at POST /prepayment (ADR-0026). */
export interface PrepaymentStamp {
  /** Gap in tiyin: totalWithMarkup - effectiveLimit. Installments run on this less. */
  amount: number;
  confirmedAt: string;
}

export interface SessionStepData {
  client?: { userId: string; isNewClient: boolean; myidVerified: boolean; katmConsent: boolean };
  card?: {
    cardId: string;
    maskedPan: string;
    pcType: string;
    bank: string;
    holderName: string;
    expiry: string;
  };
  tariff?: {
    tariffId: string;
    name: string;
    termMonths: number;
    markupPercent: number;
    minAmount: string | null;
    maxAmount: string | null;
  };
  products?: {
    lines: Array<{
      productId: string;
      productName: string;
      price: string;
      mxikCode: string | null;
      packageCode: number | null;
      packageName: string | null;
      quantity: number;
      isLabeled: boolean;
      labels: string[];
    }>;
  };
  payment?: { paymentDay: number };
  verification?: { lang: 'ru' | 'uz'; otpVerifiedAt: string | null };
  bailsmen?: BailsmanItem[];
  katmPending?: KatmPendingState;
  scoring?: ScoringStamp;
  prepayment?: PrepaymentStamp;
}

export type DealSessionRow = typeof dealSessions.$inferSelect;

export function err(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

export function stepDataOf(session: DealSessionRow): SessionStepData {
  return (session.stepData ?? {}) as SessionStepData;
}
