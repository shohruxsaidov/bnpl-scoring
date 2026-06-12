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
  criteriaScores: Record<string, number>
}

export interface SessionStepData {
  client?: { clientId: string; isNewClient: boolean; myidVerified: boolean; katmConsent: boolean }
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
    }>
  }
  payment?: { paymentDay: number }
  verification?: { lang: 'ru' | 'uz'; otpVerifiedAt: string | null }
  katm?: SessionKatm
  scoring?: SessionScoring
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

/** The wizard's close-deal action. */
export async function abandonDealSession(sessionId: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/merchant/deal-sessions/${sessionId}/abandon`, {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
