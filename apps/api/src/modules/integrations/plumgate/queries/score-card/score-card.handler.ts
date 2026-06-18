import {
  env, db, logIntegration, IntegrationError,
  makePlumClient, parsePlumError, delay, scoreToDecision, scoreToLimit,
} from '../../service/shared';
import type { PlumScoreResult, PlumScoringCreateResponse, PlumUzcardScoreResponse, PlumHumoScoreResponse } from '../../service/shared';
import { mockScoreCard } from '../../mock';

export type { PlumScoreResult };

export async function scoreCard(params: {
  plumCardId: string;
  pcType: 'uzcard' | 'humo';
}): Promise<PlumScoreResult> {
  console.log('[plum] scoreCard called:', JSON.stringify(params), 'PLUM_MOCK:', env.PLUM_MOCK);
  if (env.PLUM_MOCK) return mockScoreCard(params);
  return params.pcType === 'humo'
    ? scoreHumo(params.plumCardId)
    : scoreUzcard(params.plumCardId);
}

async function scoreUzcard(userCardId: string): Promise<PlumScoreResult> {
  const client = makePlumClient();

  const endDate = new Date();
  const beginDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
  const createBody = { cardId: userCardId, templateId: env.PLUM_TEMPLATE_ID, beginDate, endDate };
  console.log('[plum] scoreUzcard createScoringCard request:', JSON.stringify(createBody));
  let scoringId: number;

  const createRequestTimestamp = new Date();
  try {
    const data = await client
      .post('Scoring/createScoringCard', { json: createBody })
      .json<PlumScoringCreateResponse>();

    console.log('[plum] scoreUzcard createScoringCard response:', JSON.stringify(data));
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'createScoringCard',
      methodType: 'POST',
      request: createBody,
      response: data,
      status: 200,
      errorMessage: null,
      requestTimestamp: createRequestTimestamp,
      responseTimestamp: new Date(),
    });

    scoringId = data.result.scoringId;
  } catch (err) {
    console.error({ err: (err as any)?.data || err });
    const toThrow = await parsePlumError(err);
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'createScoringCard',
      methodType: 'POST',
      request: createBody,
      response: toThrow instanceof IntegrationError ? toThrow.body : null,
      status: toThrow instanceof IntegrationError ? toThrow.statusCode : null,
      errorMessage: toThrow.message,
      requestTimestamp: createRequestTimestamp,
      responseTimestamp: new Date(),
    });
    throw toThrow;
  }

  const pollParams = { scoringId };
  for (let attempt = 0; attempt < 10; attempt++) {
    await delay(10000);
    const requestTimestamp = new Date();
    try {
      const data = await client
        .get('Scoring/scoringGetPoint', { searchParams: pollParams })
        .json<PlumUzcardScoreResponse>();

      console.log(`[plum] scoreUzcard scoringGetPoint attempt ${attempt}:`, JSON.stringify(data));
      logIntegration(db, {
        integration: 'plumgate',
        methodName: 'scoringGetPoint',
        methodType: 'GET',
        request: { ...pollParams, attempt },
        response: data,
        status: 200,
        errorMessage: null,
        requestTimestamp,
        responseTimestamp: new Date(),
      });

      // TODO remove the hardcoded result once the live API is tested and confirmed to return the expected fields
      const result: PlumScoreResult = {
        score: 660,
        limit: 1_400_000,
        decision: 'approved',
      };
      console.log('[plum] scoreUzcard result:', JSON.stringify(result));
      return result;
    } catch (err) {
      const toLog = await parsePlumError(err);
      console.log(`[plum] scoreUzcard scoringGetPoint attempt ${attempt} failed:`, toLog.message);
      logIntegration(db, {
        integration: 'plumgate',
        methodName: 'scoringGetPoint',
        methodType: 'GET',
        request: { ...pollParams, scoringId, attempt },
        response: toLog instanceof IntegrationError ? toLog.body : null,
        status: toLog instanceof IntegrationError ? toLog.statusCode : null,
        errorMessage: toLog.message,
        requestTimestamp,
        responseTimestamp: new Date(),
      });
    }
  }

  throw new Error('PlumGate Uzcard scoring timed out after 10 attempts');
}

async function scoreHumo(userCardId: string): Promise<PlumScoreResult> {
  const client = makePlumClient();

  const createBody = { userCardId, templateId: env.PLUM_TEMPLATE_ID };
  console.log('[plum] scoreHumo HumoScoring request:', JSON.stringify(createBody));
  let scoringId: number;

  const createRequestTimestamp = new Date();
  try {
    const data = await client
      .post('Scoring/HumoScoring', { json: createBody })
      .json<PlumScoringCreateResponse>();

    console.log('[plum] scoreHumo HumoScoring response:', JSON.stringify(data));
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'HumoScoring',
      methodType: 'POST',
      request: createBody,
      response: data,
      status: 200,
      errorMessage: null,
      requestTimestamp: createRequestTimestamp,
      responseTimestamp: new Date(),
    });

    scoringId = data.result.scoringId;
  } catch (err) {
    const toThrow = await parsePlumError(err);
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'HumoScoring',
      methodType: 'POST',
      request: createBody,
      response: toThrow instanceof IntegrationError ? toThrow.body : null,
      status: toThrow instanceof IntegrationError ? toThrow.statusCode : null,
      errorMessage: toThrow.message,
      requestTimestamp: createRequestTimestamp,
      responseTimestamp: new Date(),
    });
    throw toThrow;
  }

  const avgBody = { scoringId };
  for (let attempt = 0; attempt < 10; attempt++) {
    await delay(1000);
    const requestTimestamp = new Date();
    try {
      const data = await client
        .post('Scoring/HumoScoringAvg', { json: avgBody })
        .json<PlumHumoScoreResponse>();

      console.log(`[plum] scoreHumo HumoScoringAvg attempt ${attempt}:`, JSON.stringify(data));
      if (data.avgScore != null) {
        logIntegration(db, {
          integration: 'plumgate',
          methodName: 'HumoScoringAvg',
          methodType: 'POST',
          request: { ...avgBody, attempt },
          response: data,
          status: 200,
          errorMessage: null,
          requestTimestamp,
          responseTimestamp: new Date(),
        });

        const result = {
          score: data.avgScore,
          limit: scoreToLimit(data.avgScore, data.creditLimit),
          decision: scoreToDecision(data.avgScore),
        };
        console.log('[plum] scoreHumo result:', JSON.stringify(result));
        return result;
      }
    } catch (err) {
      const toLog = await parsePlumError(err);
      console.log(`[plum] scoreHumo HumoScoringAvg attempt ${attempt} failed:`, toLog.message);
      logIntegration(db, {
        integration: 'plumgate',
        methodName: 'HumoScoringAvg',
        methodType: 'POST',
        request: { ...avgBody, attempt },
        response: toLog instanceof IntegrationError ? toLog.body : null,
        status: toLog instanceof IntegrationError ? toLog.statusCode : null,
        errorMessage: toLog.message,
        requestTimestamp,
        responseTimestamp: new Date(),
      });
    }
  }

  throw new Error('PlumGate Humo scoring timed out after 10 attempts');
}
