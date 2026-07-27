import { logIntegration } from '../../../log';
import { db, IntegrationError, makePlumClient, parsePlumError } from '../../service/shared';
import { ConfirmPaymentCommand } from './confirm-payment.command';

export const confirmPaymentHandler = async ({ sessionId, otp }: ConfirmPaymentCommand) => {
  const client = makePlumClient();
  const payload = {
    session: sessionId,
    otp,
  };

  const requestTimestamp = new Date();
  try {
    const data = await client.post('Payment/confirmPayment', { json: payload }).json<{
      result: { transactionId: string };
    }>();

    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'Payment/confirmPayment',
      methodType: 'POST',
      request: payload,
      response: data,
      status: 200,
      errorMessage: null,
      requestTimestamp,
      responseTimestamp: new Date(),
    });
    return {
      sessionId: data.result.transactionId,
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
};
