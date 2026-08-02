// ---------------------------------------------------------------------------
// Plumgate card-behaviour scoring — the vendor calls behind the plum_card
// pipeline. These are thin: they call, log, parse, and return. The retry /
// polling / persistence logic lives in the BullMQ worker (../../card-scoring),
// because the two rails have fundamentally different call shapes:
//
//   Uzcard — ASYNC. createScoringCard returns a scoringId; scoringGetPoint is
//            empty until the vendor has computed the template. Two phases, and
//            the scoringId MUST be persisted between them or a retry re-creates
//            (and re-bills) the scoring.
//   Humo   — SYNC. No template, no scoringId, no handshake. One call, one answer.
//
// The results are NOT commensurable and no attempt is made to make them so.
// Uzcard yields template points against a fixed ceiling; Humo yields unbounded
// million-som buckets. Nothing here derives a limit or a decision — this data is
// observational (it does not feed the model).
// ---------------------------------------------------------------------------
import {
  env,
  db,
  logIntegration,
  IntegrationError,
  makePlumClient,
  parsePlumError,
} from '../../service/shared';
import type {
  PlumHumoAvgResponse,
  PlumHumoMonthlyResponse,
  PlumHumoScoreRow,
  PlumScoringCreateResponse,
  PlumUzcardScoreResponse,
} from '../../service/shared';

/** Thrown when the vendor has not finished computing an Uzcard scoring yet. */
export class PlumScorePendingError extends Error {
  constructor() {
    super('plum_score_pending');
    this.name = 'PlumScorePendingError';
  }
}

async function logged<T>(
  methodName: string,
  methodType: 'GET' | 'POST',
  request: unknown,
  call: () => Promise<T>,
): Promise<T> {
  const requestTimestamp = new Date();
  try {
    const response = await call();
    logIntegration(db, {
      integration: 'plumgate',
      methodName,
      methodType,
      request,
      response,
      status: 200,
      errorMessage: null,
      requestTimestamp,
      responseTimestamp: new Date(),
    });
    return response;
  } catch (err) {
    const toThrow = await parsePlumError(err);
    logIntegration(db, {
      integration: 'plumgate',
      methodName,
      methodType,
      request,
      response: toThrow instanceof IntegrationError ? toThrow.body : null,
      status: toThrow instanceof IntegrationError ? toThrow.statusCode : null,
      errorMessage: toThrow.message,
      requestTimestamp,
      responseTimestamp: new Date(),
    });
    throw toThrow;
  }
}

// --- Uzcard: phase 1 — create ------------------------------------------------

/** The observation window a scoring is measured over — fixed at enqueue time so
 *  create, fetch and the stored summary can never disagree about the period. */
export interface PlumScoreWindow {
  beginDate: Date;
  endDate: Date;
}

/** Opens a template scoring at the vendor. Returns the vendor's scoringId. */
export async function createUzcardScoring(
  plumCardId: string,
  window: PlumScoreWindow,
): Promise<number> {
  const { beginDate, endDate } = window;
  const body = { cardId: plumCardId, templateId: env.PLUM_TEMPLATE_ID, beginDate, endDate };
  const client = makePlumClient();

  const data = await logged('createScoringCard', 'POST', body, () =>
    client.post('Scoring/createScoringCard', { json: body }).json<PlumScoringCreateResponse>(),
  );
  return data.result.scoringId;
}

// --- Uzcard: phase 2 — fetch -------------------------------------------------

export interface UzcardScoreResult {
  plumScoringId: number;
  scoredBall: number;
  maxScoreBall: number;
  criteria: Array<{ name: string; category: string; ball: number }>;
}

/**
 * Reads the computed template score. Throws PlumScorePendingError while the
 * vendor is still working — the caller (a BullMQ job) turns that into a retry.
 */
export async function fetchUzcardScore(plumScoringId: number): Promise<UzcardScoreResult> {
  const params = { scoringId: plumScoringId };
  const client = makePlumClient();

  const data = await logged('scoringGetPoint', 'GET', params, () =>
    client
      .get('Scoring/scoringGetPoint', { searchParams: params })
      .json<{ result: PlumUzcardScoreResponse }>(),
  );

  // An empty scoreList means "not computed yet", not "this card scored zero" —
  // a scored card always reports at least the criteria it could evaluate.
  if (!data?.result?.scoreList?.length) throw new PlumScorePendingError();

  return {
    plumScoringId,
    scoredBall: data.result.scoredBall,
    maxScoreBall: data.result.maxScoreBall,
    criteria: data.result.scoreList.map((i) => ({
      name: i.templateName,
      category: i.categoryName,
      ball: i.ball,
    })),
  };
}

// --- Humo: one shot ----------------------------------------------------------

export interface HumoScoreResult {
  /** Per-month series. The averages cannot be un-averaged, so it is fetched too. */
  monthly: PlumHumoScoreRow[];
}

export async function fetchHumoScore(
  plumCardId: string,
  window: PlumScoreWindow,
  expiry: string, // "3006" year and month
): Promise<HumoScoreResult> {
  const body = { cardId: plumCardId, startDate: window.beginDate, endDate: window.endDate };
  const client = makePlumClient();

  // Best-effort: the monthly series is the richer signal (trend, volatility) but
  // the average is the headline. Losing the series must not lose the row.
  let monthly: PlumHumoScoreRow[] = [];
  try {
    const report = await logged('HumoScoring', 'POST', body, () =>
      client.post('Scoring/HumoScoring', { json: body }).json<PlumHumoMonthlyResponse>(),
    );
    monthly = report.result?.report ?? [];
  } catch (err) {
    console.error('HumoScoring failed', err);
    // Logged by logged(); the average still stands.
  }

  return { monthly };
}
