import {
  env,
  db,
  logIntegration,
  IntegrationError,
  makePlumClient,
  parsePlumError,
  toPlumCard,
} from '../../service/shared';
import type { PlumCard, PlumConfirmUserCardCreateResponse } from '../../service/shared';
import type { ConfirmCardCommand } from './confirm-card.command';

export type { PlumCard };

export async function confirmCard(params: ConfirmCardCommand): Promise<PlumCard> {
  const client = makePlumClient();
  const reqBody = { session: params.sessionId, otp: params.otp, cardName: 'Default card name' };

  const requestTimestamp = new Date();
  try {
    // TODO adjust to actual response shape once tested against live API
    const data = await client
      .post('UserCard/confirmUserCardCreate', { json: reqBody })
      .json<{ result: PlumConfirmUserCardCreateResponse }>();

    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'confirmUserCardCreate',
      methodType: 'POST',
      request: reqBody,
      response: data,
      status: 200,
      errorMessage: null,
      requestTimestamp,
      responseTimestamp: new Date(),
    });

    return toPlumCard({
      id: data.result.card.id,
      cardId: data.result.card.cardId.toString(),
      number: data.result.card.number,
      owner: data.result.card.owner,
      expireDate: data.result.card.expireDate,
      pcType: data.result.card.pcType,
      status: data.result.card.status,
      isTrusted: data.result.card.isTrusted,
      isPrimary: data.result.card.isOwn,
    });
  } catch (err) {
    const toThrow = await parsePlumError(err);
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'confirmUserCardCreate',
      methodType: 'POST',
      request: reqBody,
      response: toThrow instanceof IntegrationError ? toThrow.body : null,
      status: toThrow instanceof IntegrationError ? toThrow.statusCode : null,
      errorMessage: toThrow.message,
      requestTimestamp,
      responseTimestamp: new Date(),
    });
    throw toThrow;
  }
}
