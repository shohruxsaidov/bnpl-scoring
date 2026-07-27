import { logIntegration } from '../../../log';
import { db, makePlumClient, parsePlumError } from '../../service/shared';
import { ConfirmPaymentCommand } from './confirm-payment.command';

/**
 * Verifies the OTP and CHARGES THE CARD. Irreversible: there is no reversal
 * endpoint wired anywhere in this system, so nothing that could refuse the
 * payment may run after this returns. See client/payments/pay.service.ts.
 */
export const confirmPaymentHandler = async ({
  sessionId,
  otp,
}: ConfirmPaymentCommand): Promise<{ transactionId: string }> => {
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
      transactionId: data.result.transactionId,
    };
  } catch (err) {
    const toThrow = await parsePlumError(err);
    // parsePlumError returns a PLAIN OBJECT for a vendor HTTP failure, never an
    // IntegrationError — an `instanceof` check here silently logs null for both
    // the status and the body, which is exactly the forensic trail a failed
    // payment needs. Read the fields off whatever shape came back instead.
    const failure = toThrow as { statusCode?: number; body?: unknown; message?: string };
    logIntegration(db, {
      integration: 'plumgate',
      methodName: 'Payment/confirmPayment',
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
};
