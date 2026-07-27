import { db, logIntegration, makePlumClient, parsePlumError } from '../../service/shared';
import { MakingPaymentCommand } from './making-payment.command';

/**
 * Registers a card payment at Plumgate and triggers the OTP SMS. Charges
 * nothing — the money moves at confirmPayment. Safe to fail: a session nobody
 * confirms costs an SMS and expires.
 */
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
    // See confirm-payment.handler.ts: parsePlumError yields a plain object, not
    // an IntegrationError, so an `instanceof` test discards the vendor's own
    // status and body — the only record of why the payment could not start.
    const failure = toThrow as { statusCode?: number; body?: unknown; message?: string };
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'Payment/payment',
      methodType: 'POST',
      request: payload,
      response: failure.body ?? null,
      status: failure.statusCode ?? null,
      errorMessage: failure.message ?? String(toThrow),
      requestTimestamp,
      responseTimestamp: new Date(),
    });
    throw toThrow;
  }
}
