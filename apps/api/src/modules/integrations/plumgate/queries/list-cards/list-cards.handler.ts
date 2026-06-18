import { env, db, logIntegration, IntegrationError, makePlumClient, parsePlumError, toPlumCard } from '../../service/shared';
import type { PlumCard, PlumCardRaw } from '../../service/shared';
import { mockListCards } from '../../mock';

export type { PlumCard };

export async function listCards(userId: string): Promise<PlumCard[]> {
  if (env.PLUM_MOCK) return mockListCards();
  const client = makePlumClient();
  const reqParams = { userId };

  const requestTimestamp = new Date();
  try {
    const data = await client
      .get('UserCard/getAllUserCards', { searchParams: reqParams })
      .json<PlumCardRaw>();

    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'getAllUserCards',
      methodType: 'GET',
      request: reqParams,
      response: data,
      status: 200,
      errorMessage: null,
      requestTimestamp,
      responseTimestamp: new Date(),
    });

    return (data.result?.cards ?? []).map(toPlumCard);
  } catch (err) {
    const toThrow = await parsePlumError(err);
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'getAllUserCards',
      methodType: 'GET',
      request: reqParams,
      response: toThrow instanceof IntegrationError ? toThrow.body : null,
      status: toThrow instanceof IntegrationError ? toThrow.statusCode : null,
      errorMessage: toThrow.message,
      requestTimestamp,
      responseTimestamp: new Date(),
    });
    throw toThrow;
  }
}
