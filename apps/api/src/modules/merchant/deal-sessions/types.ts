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

/**
 * Idle budget for a Wizard run. A session with no WRITE (saveStep or any server
 * stamp — reads never touch updatedAt) for this long is reaped to `expired`.
 * A product rule, not a per-deploy knob — kept as a constant, not env.
 */
export const DEAL_SESSION_TTL_MS = 2 * 60 * 60 * 1000; // 2h

/**
 * How long after expiry the "your deal expired — we recommend starting over"
 * banner keeps showing (2× TTL — covers a lunch-plus-meeting return). Older than
 * this and the notice is stale nagging, so GET /active stops surfacing it.
 */
export const DEAL_SESSION_EXPIRED_NOTICE_WINDOW_MS = 4 * 60 * 60 * 1000; // 4h

export function err(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code });
}

export function stepDataOf(session: DealSessionRow): SessionStepData {
  return (session.stepData ?? {}) as SessionStepData;
}

/**
 * True when an `active` session has gone idle past the TTL and should be reaped.
 * katmPending sessions are EXEMPT — a BullMQ poll worker owns them while a bureau
 * report is in flight (and polling never exceeds the TTL anyway), so the "no
 * writes" idle is an artifact of reads-don't-bump, not real abandonment.
 */
export function isSessionStale(session: DealSessionRow, now: Date = new Date()): boolean {
  if (session.status !== 'active') return false;
  if (stepDataOf(session).katmPending?.status === 'pending') return false;
  return now.getTime() - session.updatedAt.getTime() > DEAL_SESSION_TTL_MS;
}
