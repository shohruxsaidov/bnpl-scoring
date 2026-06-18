import ky, { HTTPError } from 'ky';
import { db } from '@db';
import { env } from '../../../../env';
import { IntegrationError } from '../../../../lib/integrations';
import { logIntegration } from '../../log';

export { db, env, logIntegration, IntegrationError };

// ---------------------------------------------------------------------------
// Client factory
// ---------------------------------------------------------------------------

export function makePlumClient() {
  if (!env.PLUM_LOGIN || !env.PLUM_PASSWORD) {
    throw new Error('PLUM_LOGIN / PLUM_PASSWORD are not configured');
  }
  const credentials = Buffer.from(`${env.PLUM_LOGIN}:${env.PLUM_PASSWORD}`).toString('base64');
  const base = env.PLUM_BASE_URL.endsWith('/') ? env.PLUM_BASE_URL : `${env.PLUM_BASE_URL}/`;
  return ky.create({
    prefix: base,
    timeout: env.PLUM_TIMEOUT,
    retry: 0,
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/json',
    },
  });
}

// ---------------------------------------------------------------------------
// Vendor response types
// ---------------------------------------------------------------------------

export interface PlumCardResponse {
  error: unknown;
  result: {
    cards: PlumCardRaw[];
  };
}

export interface PlumCardRaw {
  error: unknown;
  result: {
    cards: PlumCardItem[];
  };
}

export interface PlumCardItem {
  id: number;
  cardId: string;
  number: string;
  owner: string;
  expireDate: string;
  pcType: string;
  status: number;
  isTrusted: boolean;
  isPrimary: boolean;
}

export interface PlumAddCardResponse {
  sessionId: string;
  phone: string;
}

export interface PlumScoringCreateResponse {
  result: {
    scoringId: number;
  };
}

export interface PlumUzcardScoreResponse {
  score: number;
  creditLimit?: number;
}

export interface PlumHumoScoreResponse {
  avgScore: number;
  creditLimit?: number;
}

export interface PlumConfirmUserCardCreateResponse {
  card: {
    id: number;
    userId: string;
    cardId: number;
    owner: string;
    cardName: string;
    number: string;
    balance: number;
    expireDate: string;
    isTrusted: boolean;
    status: number;
    errorCode: number;
    errorMessage: string;
    isOwn: boolean;
    pcType: number;
  };
}

// ---------------------------------------------------------------------------
// Public DTOs
// ---------------------------------------------------------------------------

export interface PlumCard {
  id: number;
  plumCardId: string;
  maskedPan: string;
  holderName: string;
  expiry: string;
  bank: 'Uzcard' | 'Humo';
  pcType: 'uzcard' | 'humo';
}

export interface PlumAddCardResult {
  sessionId: string;
  maskedPhone: string;
}

export interface PlumScoreResult {
  score: number;
  limit: number;
  decision: 'approved' | 'manual_review' | 'declined';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** "0827" → "08/27" */
export function formatExpiry(raw: string): string {
  if (raw.includes('/')) return raw;
  return `${raw.slice(0, 2)}/${raw.slice(2)}`;
}

/** "08/27" → "0827" */
export function normaliseExpiry(input: string): string {
  input = input.replace('/', '');
  const month = input.slice(0, 2);
  const year = input.slice(2);
  return `${year}${month}`;
}

export function normalisePcType(raw: string): 'uzcard' | 'humo' {
  return raw.toLowerCase().includes('humo') ? 'humo' : 'uzcard';
}

export function toPlumCard(r: PlumCardItem): PlumCard {
  const pcType = normalisePcType(`${r.pcType}`);
  return {
    id: r.id,
    plumCardId: r.cardId,
    maskedPan: r.number,
    holderName: r.owner,
    expiry: formatExpiry(r.expireDate),
    bank: pcType === 'humo' ? 'Humo' : 'Uzcard',
    pcType,
  };
}

export function scoreToDecision(score: number): 'approved' | 'manual_review' | 'declined' {
  if (score >= 700) return 'approved';
  if (score >= 600) return 'manual_review';
  return 'declined';
}

export function scoreToLimit(score: number, vendorLimit?: number): number {
  if (vendorLimit && vendorLimit > 0) return vendorLimit;
  if (score >= 700) return 700_000_000;
  if (score >= 600) return 400_000_000;
  return 0;
}

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function parsePlumError(err: unknown): Promise<IntegrationError | Error> {
  if (err instanceof HTTPError) {
    let body: unknown = null;
    try {
      body = (err as any).data;
    } catch {
      body = await err.response.text().catch(() => null);
    }
    return new IntegrationError('plumgate', err.response.status, body);
  }
  return err instanceof Error ? err : new Error(String(err));
}
