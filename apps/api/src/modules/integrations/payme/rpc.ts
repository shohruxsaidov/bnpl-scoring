import { db } from '@db';
import { logIntegration } from '../log';
import { PaymeRpcError, paymeErrors } from './errors';
import {
  cancelTransaction,
  checkPerformTransaction,
  checkTransaction,
  createTransaction,
  getStatement,
  performTransaction,
} from './methods';
import type { PaymeRequest, PaymeResponse } from './protocol';

// ---------------------------------------------------------------------------
// The JSON-RPC dispatcher, and the error boundary that makes the whole endpoint
// safe.
//
// THE RULE: this function never throws and never produces a non-200. A Payme
// call that gets a 4xx/5xx, an HTML error page, or a dropped connection is a
// transport failure as far as Payme is concerned, and it retries — potentially
// re-driving a PerformTransaction for money already booked. Every failure path,
// including ones nobody anticipated, has to come out as a JSON-RPC error object
// at HTTP 200.
// ---------------------------------------------------------------------------

type MethodHandler = (params: Record<string, unknown>) => Promise<unknown>;

const HANDLERS: Record<string, MethodHandler> = {
  CheckPerformTransaction: checkPerformTransaction,
  CreateTransaction: createTransaction,
  PerformTransaction: performTransaction,
  CancelTransaction: cancelTransaction,
  CheckTransaction: checkTransaction,
  GetStatement: getStatement,
};

function errorResponse(id: number | string | null, err: PaymeRpcError): PaymeResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: err.code,
      message: err.rpcMessage,
      ...(err.data !== undefined ? { data: err.data } : {}),
    },
  };
}

/**
 * Run one RPC call and render its response.
 *
 * `authError` is passed in rather than thrown by the caller so that an
 * unauthorized call is still logged and still answered in protocol shape.
 */
export async function dispatchPayme(
  body: unknown,
  authError: PaymeRpcError | null,
): Promise<PaymeResponse> {
  const request = (body ?? {}) as Partial<PaymeRequest>;
  const id = (request.id ?? null) as number | string | null;
  const method = typeof request.method === 'string' ? request.method : '';
  const params = (request.params ?? {}) as Record<string, unknown>;

  const requestTimestamp = new Date();
  let response: PaymeResponse;

  try {
    if (authError) throw authError;

    const handler = HANDLERS[method];
    if (!handler) throw paymeErrors.methodNotFound(method);

    response = { jsonrpc: '2.0', id, result: await handler(params) };
  } catch (err) {
    // A PaymeRpcError is an expected, classified outcome. Anything else is a
    // bug or an outage, and Payme learns only that the service failed.
    response = errorResponse(id, err instanceof PaymeRpcError ? err : paymeErrors.internal());
    if (!(err instanceof PaymeRpcError)) {
      console.error('[payme] unhandled error in %s', method || '<no method>', err);
    }
  }

  // Every call, success or failure. When Payme support asks why a transaction is
  // stuck, this is the only record of what they actually sent us.
  logIntegration(db, {
    integration: 'payme',
    methodName: method || 'unknown',
    methodType: 'JSONRPC',
    request: request as Record<string, unknown>,
    response: response as unknown as Record<string, unknown>,
    // Always 200 on the wire; the JSON-RPC code is the real outcome.
    status: 200,
    errorMessage: 'error' in response ? `${response.error.code}: ${response.error.message.ru}` : null,
    requestTimestamp,
    responseTimestamp: new Date(),
  });

  return response;
}
