import { apiFetch } from '@/utils/apiFetch'
import type { Client } from '@/types'

// ---------------------------------------------------------------------------
// Deal Session (ADR-0024) — the server-side record of a Wizard run.
// The server is the source of truth: every step is saved (blocking) before the
// wizard advances, and the Deal is built FROM the session at the end.
// ---------------------------------------------------------------------------

export interface SessionKatm {
  clientId: string
  claimId: string
  demandId: string
  consentId: string
  consentDate: string
  score: number
  scoringClass: string
  scoringLevel: string
  activeLoans: number
  allDebtSum: number
  overdueCount: number
  overdueAmount: number
  hasDefaults: boolean
  hasCreditBan: boolean
}

export interface SessionScoring {
  cardId: string
  scoringId: string | null
  scoreSum: number
  coefficient: number
  decision: string
  platformCreditLimit: number
  criteriaScores: Record<string, unknown>
}

/**
 * The Верификация step's two proofs, stamped by the server and never written by
 * us. MyID (identity) comes first, the OTP (акцепт) last; both must still be
 * fresh — SIGNING_PROOF_TTL_MS on the server — when the Deal is created.
 */
export interface SessionSigning {
  pinfl: string
  myidVerifiedAt: string
  otpVerifiedAt?: string
}

/** Mirrors the server's SIGNING_PROOF_TTL_MS — a face-scan proves presence NOW. */
export const SIGNING_PROOF_TTL_MS = 15 * 60 * 1000

export function isSigningProofFresh(at: string | null | undefined, now = Date.now()): boolean {
  if (!at) return false
  const stamped = Date.parse(at)
  return Number.isFinite(stamped) && now - stamped <= SIGNING_PROOF_TTL_MS
}

export interface SessionStepData {
  client?: { isNewClient: boolean; myidVerified: boolean; katmConsent: boolean }
  card?: { cardId: string; maskedPan: string; pcType: 'uzcard' | 'humo'; bank: string; holderName: string; expiry: string }
  tariff?: {
    tariffId: string
    name: string
    termMonths: number
    markupPercent: number
    minAmount: string | null
    maxAmount: string | null
  }
  products?: {
    lines: Array<{
      productId: string
      productName: string
      price: string
      mxikCode: string | null
      packageCode: number | null
      packageName: string | null
      quantity: number
      isLabeled?: boolean
      labels?: string[]
    }>
  }
  payment?: { paymentDay: number }
  verification?: { lang: 'ru' | 'uz' }
  signing?: SessionSigning
  katm?: SessionKatm
  katmPending?: { status: 'pending' | 'failed'; startedAt: string; error?: string }
  scoring?: SessionScoring
  prepayment?: { amount: number; confirmedAt: string }
  bailsmen?: Array<{ relation: 'father' | 'mother' | 'brother' | 'friend' | 'other'; phone: string }>
  /** Which step sequence this run follows (reuse scoring). Absent ⇒ 'full'. */
  flowMode?: 'full' | 'reuse'
}

export interface DealSessionDto {
  id: string
  currentStep: string
  status: 'active' | 'completed' | 'abandoned'
  stepData: SessionStepData
  client: Client | null
  createdAt: string
  updatedAt: string
}

/** The agent's single active session, or null. */
export async function fetchActiveSession(): Promise<DealSessionDto | null> {
  const res = await apiFetch<{ session: DealSessionDto | null }>('/merchant/deal-sessions/active')
  return res.session
}

/** Open a new Wizard run. The server abandons any previous active session. */
export async function createDealSession(): Promise<DealSessionDto> {
  const res = await apiFetch<{ session: DealSessionDto }>('/merchant/deal-sessions', {
    method: 'POST',
    body: JSON.stringify({}),
  })
  return res.session
}

/** Blocking per-step save — the wizard must not advance unless this succeeds. */
export async function saveSessionStep(
  sessionId: string,
  step: string,
  payload: Record<string, unknown>,
): Promise<DealSessionDto> {
  const res = await apiFetch<{ session: DealSessionDto }>(
    `/merchant/deal-sessions/${sessionId}/steps/${step}`,
    { method: 'PUT', body: JSON.stringify(payload) },
  )
  return res.session
}

/** Phase 1 — send card details, get back an OTP session (ADR-0026). */
export async function requestPrepayment(
  dealSessionId: string,
  payload: { cardNumber: string; expiry: string; phone: string },
): Promise<{ sessionId: string; maskedPhone: string }> {
  return apiFetch<{ sessionId: string; maskedPhone: string }>(
    `/merchant/deal-sessions/${dealSessionId}/prepayment/request`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
}

/** Phase 2 — confirm OTP and stamp the prepayment (ADR-0026). */
export async function confirmPrepayment(
  dealSessionId: string,
  payload: { sessionId: string; otp: string },
): Promise<DealSessionDto> {
  const res = await apiFetch<{ session: DealSessionDto }>(
    `/merchant/deal-sessions/${dealSessionId}/prepayment/confirm`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
  return res.session
}

/** The wizard's close-deal action. */
export async function abandonDealSession(sessionId: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/merchant/deal-sessions/${sessionId}/abandon`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
