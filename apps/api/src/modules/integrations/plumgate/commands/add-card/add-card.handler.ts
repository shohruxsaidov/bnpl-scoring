import {
  env,
  db,
  logIntegration,
  IntegrationError,
  makePlumClient,
  parsePlumError,
  normaliseExpiry,
} from '../../service/shared';
import type { PlumAddCardResult } from '../../service/shared';
import type { AddCardCommand } from './add-card.command';

export type { PlumAddCardResult };

export async function addCard(params: AddCardCommand): Promise<PlumAddCardResult> {
  const client = makePlumClient();
  const reqBody = {
    userId: params.userId,
    userPhone: params.phone,
    cardNumber: params.cardNumber.replace(/\s/g, ''),
    expireDate: normaliseExpiry(params.expiry),
    templateId: env.PLUM_TEMPLATE_ID,
  };

  const requestTimestamp = new Date();
  try {
    const data = await client.post('UserCard/createUserCard', { json: reqBody }).json<{
      result: { session: string; otpSentPhone: string };
    }>();

    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'createUserCard',
      methodType: 'POST',
      request: reqBody,
      response: data,
      status: 200,
      errorMessage: null,
      requestTimestamp,
      responseTimestamp: new Date(),
    });

    return { sessionId: data.result.session, maskedPhone: data.result.otpSentPhone };
  } catch (err) {
    console.error({ err: (err as any).data, reqBody }, 'Error in createUserCard');
    const toThrow = await parsePlumError(err);
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'createUserCard',
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
