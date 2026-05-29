import type { PlumCard, PlumAddCardResult, PlumScoreResult } from './service'

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

const MOCK_CARDS: PlumCard[] = [
  {
    plumCardId: 'mock-card-uzcard-001',
    maskedPan: '8600 **** **** 4417',
    holderName: 'ALISHER TOSHMATOV',
    expiry: '08/27',
    bank: 'Uzcard',
    pcType: 'uzcard',
  },
  {
    plumCardId: 'mock-card-humo-002',
    maskedPan: '9860 **** **** 7731',
    holderName: 'ALISHER TOSHMATOV',
    expiry: '03/26',
    bank: 'Humo',
    pcType: 'humo',
  },
]

// sessionId → card added during this server run
const pendingSessions = new Map<string, PlumCard>()

export async function mockListCards(): Promise<PlumCard[]> {
  await delay(400)
  return MOCK_CARDS
}

export async function mockAddCard(params: {
  clientId: string
  cardNumber: string
  expiry: string
}): Promise<PlumAddCardResult> {
  await delay(600)
  const sessionId = `mock-session-${Date.now()}`
  const pan = params.cardNumber.replace(/\s/g, '')
  const masked = pan.slice(0, 4) + ' **** **** ' + pan.slice(-4)
  const expiry = params.expiry.includes('/')
    ? params.expiry
    : `${params.expiry.slice(0, 2)}/${params.expiry.slice(2)}`

  pendingSessions.set(sessionId, {
    plumCardId: `mock-card-${Date.now()}`,
    maskedPan: masked,
    holderName: 'MOCK HOLDER',
    expiry,
    bank: pan.startsWith('9860') ? 'Humo' : 'Uzcard',
    pcType: pan.startsWith('9860') ? 'humo' : 'uzcard',
  })

  return { sessionId, maskedPhone: '+998 ** *** ** 42' }
}

export async function mockConfirmCard(params: {
  sessionId: string
  otp: string
}): Promise<PlumCard> {
  await delay(500)
  const card = pendingSessions.get(params.sessionId)
  if (!card) {
    throw Object.assign(new Error('Mock: session not found or already used'), { statusCode: 404 })
  }
  pendingSessions.delete(params.sessionId)
  MOCK_CARDS.push(card)
  return card
}

export async function mockScoreCard(params: {
  plumCardId: string
  pcType: 'uzcard' | 'humo'
}): Promise<PlumScoreResult> {
  // Simulate the ~3–5 s the real vendor takes
  await delay(2000)

  // Deterministic-ish score based on card ID so results are consistent per card
  const seed = params.plumCardId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  const score = 550 + (seed % 400)   // range 550–949

  const decision: PlumScoreResult['decision'] =
    score >= 700 ? 'approved' : score >= 600 ? 'manual_review' : 'declined'

  const limit =
    score >= 700 ? 700_000_000
    : score >= 600 ? 400_000_000
    : 0

  return { score, limit, decision }
}
