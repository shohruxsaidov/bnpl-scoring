import { and, eq } from 'drizzle-orm'
import type { Db } from '../../../db'
import { dealSessions, dealSessionEvents } from '../../deals/db/schema'
import { clients, products, tariffs } from '../../id/db/schema'

// Wizard steps in order. 'done' is a frontend-only pseudo-step; the session's
// currentStep never goes past 'verification' — completion is a status change.
export const WIZARD_STEPS = ['client', 'card', 'tariff', 'products', 'payment', 'verification'] as const
export type WizardStep = (typeof WIZARD_STEPS)[number]

export function isWizardStep(s: string): s is WizardStep {
  return (WIZARD_STEPS as readonly string[]).includes(s)
}

/** KATM result stamped by the server at /merchant/katm/query. */
export interface KatmStamp {
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
  raw: unknown
}

/** Scoring result stamped by the server at /merchant/cards/score. */
export interface ScoringStamp {
  cardId: string
  /** scoring_histories.id as string */
  scoringId: string | null
  scoreSum: number
  coefficient: number
  decision: string
  /** tiyin */
  platformCreditLimit: number
  criteriaScores: Record<string, number>
}

export interface SessionStepData {
  client?: { clientId: string; isNewClient: boolean; myidVerified: boolean; katmConsent: boolean }
  card?: { cardId: string; maskedPan: string; pcType: string; bank: string; holderName: string; expiry: string }
  // Tariff params snapshotted server-side at save time (amounts in tiyin, as strings)
  tariff?: {
    tariffId: string
    name: string
    termMonths: number
    markupPercent: number
    minAmount: string | null
    maxAmount: string | null
  }
  // Basket lines with server-snapshotted prices — what the Client consents to is
  // what the Deal is built from, even if the Product is edited afterwards
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
  katm?: KatmStamp
  scoring?: ScoringStamp
}

export type DealSessionRow = typeof dealSessions.$inferSelect

function err(code: string): Error & { code: string } {
  return Object.assign(new Error(code), { code })
}

function stepDataOf(session: DealSessionRow): SessionStepData {
  return (session.stepData ?? {}) as SessionStepData
}

async function logEvent(db: Db, sessionId: string, step: string, payload: unknown) {
  await db.insert(dealSessionEvents).values({ sessionId, step, payload })
}

/** The agent's single active session, or null. */
export async function getActiveSession(db: Db, agentId: bigint): Promise<DealSessionRow | null> {
  const [row] = await db
    .select()
    .from(dealSessions)
    .where(and(eq(dealSessions.agentId, agentId), eq(dealSessions.status, 'active')))
    .limit(1)
  return row ?? null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Load a session by id and assert it is the agent's own active session. */
export async function loadOwnedActiveSession(db: Db, id: string, agentId: bigint): Promise<DealSessionRow> {
  if (!UUID_RE.test(id)) throw err('session_not_found')
  const [row] = await db.select().from(dealSessions).where(eq(dealSessions.id, id)).limit(1)
  if (!row || row.agentId !== agentId) throw err('session_not_found')
  if (row.status !== 'active') throw err('session_not_active')
  return row
}

/**
 * Open a new Wizard run. Auto-supersedes: any existing active session for the
 * agent is marked abandoned first (ADR-0024 — one active session per Agent).
 */
export async function createSession(
  db: Db,
  input: { merchantId: bigint; branchId: bigint; agentId: bigint },
): Promise<DealSessionRow> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(dealSessions)
      .where(and(eq(dealSessions.agentId, input.agentId), eq(dealSessions.status, 'active')))
      .limit(1)
    if (existing) {
      await tx
        .update(dealSessions)
        .set({ status: 'abandoned', updatedAt: new Date() })
        .where(eq(dealSessions.id, existing.id))
      await tx
        .insert(dealSessionEvents)
        .values({ sessionId: existing.id, step: 'abandoned', payload: { reason: 'superseded' } })
    }

    const [session] = await tx
      .insert(dealSessions)
      .values({ merchantId: input.merchantId, branchId: input.branchId, agentId: input.agentId })
      .returning()
    if (!session) throw new Error('session_insert_failed')

    await tx.insert(dealSessionEvents).values({ sessionId: session.id, step: 'opened', payload: null })
    return session
  })
}

export async function abandonSession(db: Db, session: DealSessionRow): Promise<void> {
  await db
    .update(dealSessions)
    .set({ status: 'abandoned', updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id))
  await logEvent(db, session.id, 'abandoned', { reason: 'closed' })
}

/**
 * Save one step onto the session: validates and server-enriches the payload,
 * invalidates every later step (a redone step voids downstream consents —
 * ADR-0024), advances currentStep, and appends an immutable event.
 */
export async function saveStep(
  db: Db,
  session: DealSessionRow,
  step: WizardStep,
  body: Record<string, unknown>,
): Promise<DealSessionRow> {
  const data = stepDataOf(session)
  const saved = await buildStepPayload(db, session, step, body, data)

  const next: SessionStepData = { ...data, [step]: saved }

  // Invalidate all later steps
  const idx = WIZARD_STEPS.indexOf(step)
  for (const later of WIZARD_STEPS.slice(idx + 1)) delete next[later]

  // Server stamps are tied to the inputs they were computed from
  if (step === 'client') {
    const clientId = (saved as NonNullable<SessionStepData['client']>).clientId
    if (next.katm && next.katm.clientId !== clientId) delete next.katm
    if (next.scoring) delete next.scoring
  }
  if (step === 'card') {
    const cardId = (saved as NonNullable<SessionStepData['card']>).cardId
    if (next.scoring && next.scoring.cardId !== cardId) delete next.scoring
  }

  const after = WIZARD_STEPS[idx + 1] ?? 'verification'

  const [updated] = await db
    .update(dealSessions)
    .set({
      stepData: next,
      currentStep: after,
      clientId: step === 'client'
        ? BigInt((saved as NonNullable<SessionStepData['client']>).clientId)
        : session.clientId,
      updatedAt: new Date(),
    })
    .where(eq(dealSessions.id, session.id))
    .returning()
  if (!updated) throw err('session_not_found')

  await logEvent(db, session.id, step, saved)
  return updated
}

/** Merge a server-side KATM result into the session head + event trail. */
export async function stampKatm(db: Db, session: DealSessionRow, stamp: KatmStamp): Promise<void> {
  const data = stepDataOf(session)
  await db
    .update(dealSessions)
    .set({ stepData: { ...data, katm: stamp }, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id))
  await logEvent(db, session.id, 'katm', stamp)
}

/** Merge a server-side scoring result into the session head + event trail. */
export async function stampScoring(db: Db, session: DealSessionRow, stamp: ScoringStamp): Promise<void> {
  const data = stepDataOf(session)
  await db
    .update(dealSessions)
    .set({ stepData: { ...data, scoring: stamp }, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id))
  await logEvent(db, session.id, 'scoring', stamp)
}

/* ── Per-step validation & server-side enrichment ─────────────────────────── */

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null
}

async function buildStepPayload(
  db: Db,
  session: DealSessionRow,
  step: WizardStep,
  body: Record<string, unknown>,
  _data: SessionStepData,
): Promise<SessionStepData[WizardStep]> {
  switch (step) {
    case 'client': {
      const clientId = str(body['clientId'])
      if (!clientId || !/^\d+$/.test(clientId)) throw err('invalid_step_payload')
      const [client] = await db
        .select({ id: clients.id })
        .from(clients)
        .where(eq(clients.id, BigInt(clientId)))
        .limit(1)
      if (!client) throw err('client_not_found')
      return {
        clientId,
        isNewClient: body['isNewClient'] === true,
        myidVerified: body['myidVerified'] === true,
        katmConsent: body['katmConsent'] === true,
      }
    }

    case 'card': {
      const cardId = str(body['cardId'])
      const maskedPan = str(body['maskedPan'])
      if (!cardId || !maskedPan) throw err('invalid_step_payload')
      return {
        cardId,
        maskedPan,
        pcType: str(body['pcType']) ?? '',
        bank: str(body['bank']) ?? '',
        holderName: str(body['holderName']) ?? '',
        expiry: str(body['expiry']) ?? '',
      }
    }

    case 'tariff': {
      const tariffId = str(body['tariffId'])
      if (!tariffId || !/^\d+$/.test(tariffId)) throw err('invalid_step_payload')
      const [tariff] = await db.select().from(tariffs).where(eq(tariffs.id, BigInt(tariffId))).limit(1)
      if (!tariff || !tariff.active) throw err('tariff_not_found')
      return {
        tariffId,
        name: tariff.name,
        termMonths: tariff.termMonths,
        markupPercent: parseFloat(tariff.markupPercent),
        minAmount: tariff.minAmount?.toString() ?? null,
        maxAmount: tariff.maxAmount?.toString() ?? null,
      }
    }

    case 'products': {
      const rawLines = Array.isArray(body['lines']) ? (body['lines'] as unknown[]) : []
      if (rawLines.length === 0) throw err('invalid_step_payload')
      const lines = rawLines.map((l) => {
        const line = l as Record<string, unknown>
        const productId = str(line['productId'])
        const quantity = typeof line['quantity'] === 'number' ? Math.floor(line['quantity']) : 0
        if (!productId || !/^\d+$/.test(productId) || quantity < 1) throw err('invalid_step_payload')
        return { productId, quantity }
      })

      const resolved = []
      for (const line of lines) {
        const [p] = await db.select().from(products).where(eq(products.id, BigInt(line.productId))).limit(1)
        if (!p || !p.active || p.merchantId !== session.merchantId) throw err('product_not_found')
        resolved.push({
          productId: line.productId,
          productName: p.name,
          // Price snapshot — the Deal is built from this, not the live price (ADR-0024)
          price: p.price,
          mxikCode: p.mxikCode ?? null,
          packageCode: p.packageCode ?? null,
          packageName: p.packageName ?? null,
          quantity: line.quantity,
        })
      }
      return { lines: resolved }
    }

    case 'payment': {
      const day = body['paymentDay']
      if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 28) {
        throw err('invalid_step_payload')
      }
      return { paymentDay: day }
    }

    case 'verification': {
      const lang = body['lang']
      if (lang !== 'ru' && lang !== 'uz') throw err('invalid_step_payload')
      return { lang, otpVerifiedAt: str(body['otpVerifiedAt']) }
    }
  }
}
