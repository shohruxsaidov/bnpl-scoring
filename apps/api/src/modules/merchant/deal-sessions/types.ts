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

/**
 * Reuse path — a returning client who already self-scored on mobile and still
 * holds a valid, unexpired credit limit. Scoring (MyID + KATM + model) is
 * skipped, so the `card` step (whose only job was to feed the model) is replaced
 * by a contacts-only step. Same tail as the full sequence.
 */
export const REUSE_WIZARD_STEPS = [
  'client',
  'contacts',
  'tariff',
  'products',
  'payment',
  'verification',
] as const;

export type WizardStep = (typeof WIZARD_STEPS)[number] | 'contacts';

const ALL_WIZARD_STEPS = new Set<string>([...WIZARD_STEPS, ...REUSE_WIZARD_STEPS]);

export function isWizardStep(s: string): s is WizardStep {
  return ALL_WIZARD_STEPS.has(s);
}

/** The step sequence this session runs, chosen by its stamped flow mode. */
export function wizardStepsFor(session: DealSessionRow): readonly WizardStep[] {
  return stepDataOf(session).flowMode === 'reuse' ? REUSE_WIZARD_STEPS : WIZARD_STEPS;
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
  /** Gap in som: totalWithMarkup - effectiveLimit. Installments run on this less. */
  amount: number;
  confirmedAt: string;
}

/**
 * The Верификация step's two proofs, both stamped server-side — never written by
 * the browser. MyID (identity: this client is standing at the counter right now)
 * must come first; the OTP (акцепт: consent to the final terms) comes last. The
 * Deal cannot be created without both, fresh, with `pinfl` matching the session's
 * client, and with `termsHash` still matching the session's terms.
 */
export interface SigningStamp {
  /** The PINFL that actually passed the face-scan. */
  pinfl: string;
  myidVerifiedAt: string;
  otpVerifiedAt?: string;
  /**
   * Digest of the terms the client actually consented to (see deals/signing/terms).
   * Stamped WITH the акцепт, because that is the moment consent is given, and
   * re-checked at deal creation. Without it the stamp binds a person and a moment
   * but not a price — and an Agent could take the акцепт, walk back to Products,
   * and build the Deal on a basket the client never saw.
   */
  termsHash?: string;
  /** Which surface the client signed on. Absent on stamps predating remote signing. */
  channel?: SigningChannel;
}

/**
 * Where the client proves themselves. `counter` is the original flow — the scan
 * and the code happen in the Agent's browser. `remote` hands both to the client's
 * own phone, which they already have because the app is how they got their limit.
 */
export type SigningChannel = 'counter' | 'remote';

/**
 * An outstanding request for the client to sign on their own phone. A push is
 * fired alongside it, but this row — not the push — is what makes the request
 * real: the app discovers it by polling /client/deals/to-sign, so an undelivered
 * notification is a slower flow, not a dead one.
 *
 * Cleared whenever the terms move (see saveStep), because a request to sign terms
 * that no longer exist is worse than no request at all.
 */
export interface SigningRequestState {
  sentAt: string;
  /** How many times the Agent has pushed this run at the client. */
  sends: number;
  /**
   * The client tapped Отклонить. Recoverable by design — the Agent can change the
   * tariff and re-send — but recorded, so a run that was refused three times before
   * it was accepted does not look like a run that was accepted first time.
   */
  rejectedAt?: string;
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
  verification?: { lang: 'ru' | 'uz' };
  bailsmen?: BailsmanItem[];
  katmPending?: KatmPendingState;
  scoring?: ScoringStamp;
  prepayment?: PrepaymentStamp;
  signing?: SigningStamp;
  signingRequest?: SigningRequestState;
  /**
   * Which step sequence this run follows (ADR — reuse scoring). Absent ⇒ 'full'
   * (client → card → …). 'reuse' routes through the contacts step and reuses the
   * client's cached limit instead of re-scoring. Stamped by POST /:id/start.
   */
  flowMode?: 'full' | 'reuse';
}

export type DealSessionRow = typeof dealSessions.$inferSelect;

/**
 * Idle budget for a Wizard run. A session with no WRITE (saveStep or any server
 * stamp — reads never touch updatedAt) for this long is reaped to `expired`.
 * A product rule, not a per-deploy knob — kept as a constant, not env.
 */
export const DEAL_SESSION_TTL_MS = 10 * 60 * 60 * 1000; // 10h

/**
 * How long after expiry the "your deal expired — we recommend starting over"
 * banner keeps showing (2× TTL — covers a lunch-plus-meeting return). Older than
 * this and the notice is stale nagging, so GET /active stops surfacing it.
 */
export const DEAL_SESSION_EXPIRED_NOTICE_WINDOW_MS = 4 * 60 * 60 * 1000; // 4h

/**
 * How long a signing proof stands. A face-scan proves presence AT THIS MOMENT, so
 * it cannot inherit the session's 10h budget — otherwise an Agent could scan a
 * client in the morning and sign in their name that evening. Sized to cover the
 * SMS plus a resend or two (the resend cooldown alone is 60s).
 */
export const SIGNING_PROOF_TTL_MS = 15 * 60 * 1000; // 15m

export function isSigningProofFresh(at: string | null | undefined, now = Date.now()): boolean {
  if (!at) return false;
  const stamped = Date.parse(at);
  return Number.isFinite(stamped) && now - stamped <= SIGNING_PROOF_TTL_MS;
}

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
