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
  pcType: number;
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

// --- Uzcard: template scoring (the DATA-SET methodology) ---------------------
// Scoring/scoringGetPoint. `ball` is the applicant's points for that criterion;
// `categoryName` is the band that matched ("25-50 лет", "от 0 до 0"). The vendor
// reports no raw sums — only the band and the points — and criteria it did not
// evaluate are simply absent from scoreList while still counting toward
// maxScoreBall. So scoredBall/maxScoreBall can understate; do not read the ratio
// as "how good this applicant is" without checking how many criteria reported.
export interface PlumUzcardScoreItem {
  templateName: string;
  categoryName: string;
  ball: number;
}

export interface PlumUzcardScoreResponse {
  maxScoreBall: number;
  scoredBall: number;
  scoreList: PlumUzcardScoreItem[];
  scoringId: number;
}

// --- Humo: behaviour report (no template, no ceiling) ------------------------
// Scoring/HumoScoringAvg (averages, month always 0) and Scoring/HumoScoring
// (the same shape once per month). A Humo `*Score` is an unbounded million-som
// bucket — ball N means turnover in ((N-1)m, N*1m] som — NOT template points.
// Never put a Humo ball and an Uzcard ball on the same scale.
export interface PlumHumoScoreRow {
  month: number;
  totalDebitScore: number;
  totalDebitCount: number;
  replenishmentScore: number;
  replenishmentCount: number;
  creditScore: number;
  creditCount: number;
}

export interface PlumHumoAvgResponse {
  result: PlumHumoScoreRow;
}

export interface PlumHumoMonthlyResponse {
  result: {
    cardNumber?: string;
    fullName?: string;
    connectedPhone?: string;
    report: PlumHumoScoreRow[];
  };
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
  plumId: number;
  plumCardId: string;
  maskedPan: string;
  holderName: string;
  expiry: string;
  pcType: string; // uzcard;  humo
}

export interface PlumAddCardResult {
  sessionId: string;
  maskedPhone: string;
}

// Observation window for card scoring, both rails. Fixed so that an Uzcard row
// and a Humo row (and any two runs) describe the same span of history — a
// turnover figure whose period is unknown is worthless. Stamped into every
// plum_card summary rather than left implicit.
export const PLUM_SCORE_WINDOW_DAYS = 365;

export function plumScoreWindow(now: Date): { beginDate: Date; endDate: Date } {
  const beginDate = new Date(now.getTime() - PLUM_SCORE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  return { beginDate, endDate: now };
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
  const expireMonth = r.expireDate.slice(0, 2);
  const expireYear = r.expireDate.slice(2);
  return {
    id: r.id,
    plumId: r.id,
    plumCardId: r.cardId,
    maskedPan: r.number,
    holderName: r.owner,
    expiry: `${expireMonth}${expireYear}`,
    pcType: r.pcType === 1 ? 'Humo' : 'Uzcard',
  };
}

export function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function parsePlumError(err: unknown) {
  if (err instanceof HTTPError) {
    let body: any = null;
    try {
      body = (err as any).data;
    } catch {
      body = await err.response.text().catch(() => null);
    }
    return {
      message: `plumIntegrationErrors.${body?.error?.errorCode || 'undefined'}`,
      statusCode: 400,
    };
  }
  return err instanceof Error ? err : new Error(String(err));
}
