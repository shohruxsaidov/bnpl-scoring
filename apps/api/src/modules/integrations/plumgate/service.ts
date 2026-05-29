/**
 * PlumGate integration — Cards + Scoring
 *
 * Vendor base URL : PLUM_BASE_URL  (default https://pay.myuzcard.uz/api)
 * Auth            : Basic Auth (PLUM_LOGIN / PLUM_PASSWORD)
 * All requests are logged to integration_logs via logIntegration (ADR-0005).
 *
 * NOTE: PLUM vendor error codes can collide across methods — errors are always
 * logged with method_name so the full context is preserved.
 */

import ky from 'ky'
import type { Db } from '../../../db'
import { env } from '../../../env'
import { IntegrationError } from '../../../lib/integrations'
import { logIntegration } from '../log'
import { mockListCards, mockAddCard, mockConfirmCard, mockScoreCard } from './mock'

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

function makePlumClient() {
  if (!env.PLUM_LOGIN || !env.PLUM_PASSWORD) {
    throw new Error('PLUM_LOGIN / PLUM_PASSWORD are not configured')
  }
  const credentials = Buffer.from(`${env.PLUM_LOGIN}:${env.PLUM_PASSWORD}`).toString('base64')
  const base = env.PLUM_BASE_URL.endsWith('/') ? env.PLUM_BASE_URL : `${env.PLUM_BASE_URL}/`
  return ky.create({
    prefix: base,
    timeout: env.PLUM_TIMEOUT,
    retry: 0,
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  })
}

// ---------------------------------------------------------------------------
// Vendor response types
// TODO: adjust field names once tested against the live API.
// ---------------------------------------------------------------------------

interface PlumCardRaw {
  userCardId: string
  cardNumber: string   // masked PAN e.g. "8600****4417"
  owner: string
  expireDate: string   // "MMYY" e.g. "0827"
  pcType: string       // "UZCARD" | "HUMO"
  status: number
  isTrusted: boolean
  isPrimary: boolean
}

interface PlumAddCardResponse {
  sessionId: string
  phone: string        // masked phone for OTP confirmation display
}

interface PlumConfirmCardResponse {
  userCardId: string
  cardNumber: string
  owner: string
  expireDate: string
  pcType: string
  status: number
  isTrusted: boolean
  isPrimary: boolean
}

interface PlumScoringCreateResponse {
  /** Session/scoring ID returned by createScoringCard or HumoScoring */
  sessionId: string
}

interface PlumUzcardScoreResponse {
  /** Raw score 0–999 */
  score: number
  /** Optional credit limit in tiyin returned by vendor (used if present) */
  creditLimit?: number
}

interface PlumHumoScoreResponse {
  /** Average score 0–999 */
  avgScore: number
  creditLimit?: number
}

// ---------------------------------------------------------------------------
// Public DTOs (returned to callers / routes)
// ---------------------------------------------------------------------------

export interface PlumCard {
  plumCardId: string       // userCardId
  maskedPan: string
  holderName: string
  expiry: string           // "MM/YY" for display
  bank: 'Uzcard' | 'Humo'
  pcType: 'uzcard' | 'humo'
}

export interface PlumAddCardResult {
  sessionId: string
  maskedPhone: string
}

export interface PlumScoreResult {
  score: number
  limit: number            // tiyin
  decision: 'approved' | 'manual_review' | 'declined'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "0827" → "08/27" */
function formatExpiry(raw: string): string {
  if (raw.includes('/')) return raw
  return `${raw.slice(0, 2)}/${raw.slice(2)}`
}

/** "08/27" → "0827" */
function normaliseExpiry(input: string): string {
  return input.replace('/', '')
}

function normalisePcType(raw: string): 'uzcard' | 'humo' {
  return raw.toLowerCase().includes('humo') ? 'humo' : 'uzcard'
}

function toPlumCard(r: PlumCardRaw): PlumCard {
  const pcType = normalisePcType(r.pcType)
  return {
    plumCardId: r.userCardId,
    maskedPan: r.cardNumber,
    holderName: r.owner,
    expiry: formatExpiry(r.expireDate),
    bank: pcType === 'humo' ? 'Humo' : 'Uzcard',
    pcType,
  }
}

function scoreToDecision(score: number): 'approved' | 'manual_review' | 'declined' {
  if (score >= 700) return 'approved'
  if (score >= 600) return 'manual_review'
  return 'declined'
}

function scoreToLimit(score: number, vendorLimit?: number): number {
  if (vendorLimit && vendorLimit > 0) return vendorLimit
  if (score >= 700) return 700_000_000   // 7 000 000 UZS in tiyin
  if (score >= 600) return 400_000_000   // 4 000 000 UZS in tiyin
  return 0
}

// ---------------------------------------------------------------------------
// API methods
// ---------------------------------------------------------------------------

/**
 * List all cards registered in PlumGate for the given client.
 * Vendor: GET /UserCard/getAllUserCards?userId=<clientId>
 */
export async function listCards(db: Db, clientId: string): Promise<PlumCard[]> {
  if (env.PLUM_MOCK) return mockListCards()
  const client = makePlumClient()
  const reqParams = { userId: clientId }

  try {
    const data = await client
      .get('UserCard/getAllUserCards', { searchParams: reqParams })
      .json<PlumCardRaw[]>()

    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'getAllUserCards',
      methodType: 'GET',
      request: reqParams,
      response: data,
      status: 200,
      errorMessage: null,
    })

    return (data ?? []).map(toPlumCard)
  } catch (err) {
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'getAllUserCards',
      methodType: 'GET',
      request: reqParams,
      response: null,
      status: err instanceof IntegrationError ? err.statusCode : null,
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/**
 * Begin the add-card flow. PLUM sends an OTP to the client's phone.
 * Vendor: POST /UserCard/createUserCard
 */
export async function addCard(
  db: Db,
  params: {
    clientId: string
    phone: string
    cardNumber: string
    expiry: string        // accepts "MM/YY" or "MMYY"
  },
): Promise<PlumAddCardResult> {
  if (env.PLUM_MOCK) return mockAddCard(params)
  const client = makePlumClient()
  const reqBody = {
    userId: params.clientId,
    phone: params.phone,
    cardNumber: params.cardNumber.replace(/\s/g, ''),
    expireDate: normaliseExpiry(params.expiry),
    templateId: env.PLUM_TEMPLATE_ID,
  }

  try {
    const data = await client
      .post('UserCard/createUserCard', { json: reqBody })
      .json<PlumAddCardResponse>()

    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'createUserCard',
      methodType: 'POST',
      request: reqBody,
      response: data,
      status: 200,
      errorMessage: null,
    })

    return { sessionId: data.sessionId, maskedPhone: data.phone }
  } catch (err) {
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'createUserCard',
      methodType: 'POST',
      request: reqBody,
      response: null,
      status: err instanceof IntegrationError ? err.statusCode : null,
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/**
 * Confirm the OTP and finalise card registration.
 * Vendor: POST /UserCard/confirmUserCardCreate
 */
export async function confirmCard(
  db: Db,
  params: { sessionId: string; otp: string },
): Promise<PlumCard> {
  if (env.PLUM_MOCK) return mockConfirmCard(params)
  const client = makePlumClient()
  const reqBody = { sessionId: params.sessionId, smsCode: params.otp }

  try {
    const data = await client
      .post('UserCard/confirmUserCardCreate', { json: reqBody })
      .json<PlumConfirmCardResponse>()

    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'confirmUserCardCreate',
      methodType: 'POST',
      request: reqBody,
      response: data,
      status: 200,
      errorMessage: null,
    })

    return toPlumCard(data)
  } catch (err) {
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'confirmUserCardCreate',
      methodType: 'POST',
      request: reqBody,
      response: null,
      status: err instanceof IntegrationError ? err.statusCode : null,
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
}

/**
 * Score a card via PlumGate's SCORING module.
 * Routes to Uzcard or Humo path based on pcType.
 * Handles the two-step vendor flow internally (create → poll/get).
 */
export async function scoreCard(
  db: Db,
  params: { plumCardId: string; pcType: 'uzcard' | 'humo' },
): Promise<PlumScoreResult> {
  if (env.PLUM_MOCK) return mockScoreCard(params)
  return params.pcType === 'humo'
    ? scoreHumo(db, params.plumCardId)
    : scoreUzcard(db, params.plumCardId)
}

// -- Uzcard ------------------------------------------------------------------

async function scoreUzcard(db: Db, userCardId: string): Promise<PlumScoreResult> {
  const client = makePlumClient()

  // Step 1: createScoringCard
  const createBody = { userCardId, templateId: env.PLUM_TEMPLATE_ID }
  let scoringId: string

  try {
    const data = await client
      .post('Scoring/createScoringCard', { json: createBody })
      .json<PlumScoringCreateResponse>()

    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'createScoringCard',
      methodType: 'POST',
      request: createBody,
      response: data,
      status: 200,
      errorMessage: null,
    })

    scoringId = data.sessionId
  } catch (err) {
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'createScoringCard',
      methodType: 'POST',
      request: createBody,
      response: null,
      status: err instanceof IntegrationError ? err.statusCode : null,
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    throw err
  }

  // Step 2: poll scoringGetPoint until result arrives (max 10 attempts × 1 s)
  const pollParams = { cardId: userCardId }
  for (let attempt = 0; attempt < 10; attempt++) {
    await delay(1000)
    try {
      const data = await client
        .get('Scoring/scoringGetPoint', { searchParams: pollParams })
        .json<PlumUzcardScoreResponse>()

      if (data.score != null) {
        logIntegration(db, {
          integration: 'plumgate',
          methodName: 'scoringGetPoint',
          methodType: 'GET',
          request: { ...pollParams, scoringId, attempt },
          response: data,
          status: 200,
          errorMessage: null,
        })

        return {
          score: data.score,
          limit: scoreToLimit(data.score, data.creditLimit),
          decision: scoreToDecision(data.score),
        }
      }
    } catch (err) {
      // Log each failed poll attempt but keep looping
      logIntegration(db, {
        integration: 'plumgate',
        methodName: 'scoringGetPoint',
        methodType: 'GET',
        request: { ...pollParams, scoringId, attempt },
        response: null,
        status: err instanceof IntegrationError ? err.statusCode : null,
        errorMessage: err instanceof Error ? err.message : String(err),
      })
    }
  }

  throw new Error('PlumGate Uzcard scoring timed out after 10 attempts')
}

// -- Humo --------------------------------------------------------------------

async function scoreHumo(db: Db, userCardId: string): Promise<PlumScoreResult> {
  const client = makePlumClient()

  // Step 1: HumoScoring
  const createBody = { userCardId, templateId: env.PLUM_TEMPLATE_ID }
  let sessionId: string

  try {
    const data = await client
      .post('Scoring/HumoScoring', { json: createBody })
      .json<PlumScoringCreateResponse>()

    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'HumoScoring',
      methodType: 'POST',
      request: createBody,
      response: data,
      status: 200,
      errorMessage: null,
    })

    sessionId = data.sessionId
  } catch (err) {
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'HumoScoring',
      methodType: 'POST',
      request: createBody,
      response: null,
      status: err instanceof IntegrationError ? err.statusCode : null,
      errorMessage: err instanceof Error ? err.message : String(err),
    })
    throw err
  }

  // Step 2: HumoScoringAvg (poll, max 10 attempts × 1 s)
  const avgBody = { sessionId }
  for (let attempt = 0; attempt < 10; attempt++) {
    await delay(1000)
    try {
      const data = await client
        .post('Scoring/HumoScoringAvg', { json: avgBody })
        .json<PlumHumoScoreResponse>()

      if (data.avgScore != null) {
        logIntegration(db, {
          integration: 'plumgate',
          methodName: 'HumoScoringAvg',
          methodType: 'POST',
          request: { ...avgBody, attempt },
          response: data,
          status: 200,
          errorMessage: null,
        })

        return {
          score: data.avgScore,
          limit: scoreToLimit(data.avgScore, data.creditLimit),
          decision: scoreToDecision(data.avgScore),
        }
      }
    } catch (err) {
      logIntegration(db, {
        integration: 'plumgate',
        methodName: 'HumoScoringAvg',
        methodType: 'POST',
        request: { ...avgBody, attempt },
        response: null,
        status: err instanceof IntegrationError ? err.statusCode : null,
        errorMessage: err instanceof Error ? err.message : String(err),
      })
    }
  }

  throw new Error('PlumGate Humo scoring timed out after 10 attempts')
}

// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
