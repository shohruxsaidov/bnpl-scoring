import {
  env,
  db,
  logIntegration,
  IntegrationError,
  makePlumClient,
  parsePlumError,
} from '../../service/shared';
import { MakingPaymentCommand } from './making-payment.command';

// Removes a card from Plumgate. A 404 ("card not found / already removed") is
// treated as success so the caller can proceed to delete the local row
export async function makingPaymentHandler(
  params: MakingPaymentCommand,
): Promise<{ session: number; otpSentPhone: string }> {
  const client = makePlumClient();
  const payload = {
    userId: params.userId,
    cardId: params.cardId,
    amount: params.amount,
    extraId: params.extraId,
    sendOtp: true,
    transactionData: params.transactionData,
  };

  const requestTimestamp = new Date();
  try {
    const data = await client.post('Payment/payment', { json: payload }).json<{
      result: { transactionId: string; session: number; otpSentPhone: string };
    }>();

    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'Payment/payment',
      methodType: 'POST',
      request: payload,
      response: data,
      status: 200,
      errorMessage: null,
      requestTimestamp,
      responseTimestamp: new Date(),
    });
    return {
      session: data.result.session,
      otpSentPhone: data.result.otpSentPhone,
    };
  } catch (err) {
    const toThrow = await parsePlumError(err);
    const status = toThrow instanceof IntegrationError ? toThrow.statusCode : null;
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'deleteUserCard',
      methodType: 'DELETE',
      request: payload,
      response: toThrow instanceof IntegrationError ? toThrow.body : null,
      status,
      errorMessage: toThrow.message,
      requestTimestamp,
      responseTimestamp: new Date(),
    });
    throw toThrow;
  }
}
