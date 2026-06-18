import type { PlumCard, PlumAddCardResult, PlumScoreResult } from './service/service.handler';

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

const MOCK_CARDS: PlumCard[] = [
  {
    plumCardId: 'mock-card-uzcard-001',
    maskedPan: '8600 **** **** 4417',
    holderName: 'ALISHER TOSHMATOV',
    expiry: '08/27',
    bank: 'Uzcard',
    pcType: 'uzcard',
    id: 1,
  },
  {
    plumCardId: 'mock-card-humo-002',
    maskedPan: '9860 **** **** 7731',
    holderName: 'ALISHER TOSHMATOV',
    expiry: '03/26',
    bank: 'Humo',
    pcType: 'humo',
    id: 2,
  },
];

// sessionId → card added during this server run
const pendingSessions = new Map<string, PlumCard>();

export async function mockListCards(): Promise<PlumCard[]> {
  await delay(400);
  return MOCK_CARDS;
}

export async function mockAddCard(params: {
  clientId: string;
  cardNumber: string;
  expiry: string;
}): Promise<PlumAddCardResult> {
  await delay(600);
  const sessionId = `mock-session-${Date.now()}`;
  const pan = params.cardNumber.replace(/\s/g, '');
  const masked = pan.slice(0, 4) + ' **** **** ' + pan.slice(-4);
  const expiry = params.expiry.includes('/')
    ? params.expiry
    : `${params.expiry.slice(0, 2)}/${params.expiry.slice(2)}`;

  pendingSessions.set(sessionId, {
    plumCardId: `mock-card-${Date.now()}`,
    id: Date.now(), // just a unique number for the mock, not used in logic
    maskedPan: masked,
    holderName: 'MOCK HOLDER',
    expiry,
    bank: pan.startsWith('9860') ? 'Humo' : 'Uzcard',
    pcType: pan.startsWith('9860') ? 'humo' : 'uzcard',
  });

  return { sessionId, maskedPhone: '+998 ** *** ** 42' };
}

export async function mockConfirmCard(params: {
  sessionId: string;
  otp: string;
}): Promise<PlumCard> {
  await delay(500);
  const card = pendingSessions.get(params.sessionId);
  if (!card) {
    throw Object.assign(new Error('Mock: session not found or already used'), { statusCode: 404 });
  }
  pendingSessions.delete(params.sessionId);
  MOCK_CARDS.push(card);
  return card;
}

export async function mockScoreCard(params: {
  plumCardId: string;
  pcType: 'uzcard' | 'humo';
}): Promise<PlumScoreResult> {
  await delay(2000);

  // Deterministic seed per card so the same card always returns the same limit
  const seed = params.plumCardId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const score = 700 + (seed % 250); // always approved range: 700–949

  // Scatter the small char-sum seed across the full range with a multiplicative hash
  const mixed = Math.imul(seed, 2654435761) >>> 0;

  // Limit in round 100 000 som steps: 500 000 – 2 000 000 som (50 000 000 – 200 000 000 tiyin)
  const STEP = 10_000_000; // 100 000 som in tiyin
  const STEPS = 16; // 500 000, 600 000, … 2 000 000
  const limit = 50_000_000 + (mixed % STEPS) * STEP;

  return { score, limit, decision: 'approved' };
}
