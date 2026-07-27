// ---------------------------------------------------------------------------
// Plumgate error codes, classified.
//
// parsePlumError() turns a vendor HTTP failure into `{ message, statusCode, body }`
// where message is the i18n key `plumIntegrationErrors.<code>` — which is enough
// to TELL the client what went wrong, but not enough to decide what to do with
// the payment session that just failed.
//
// The distinction that matters is RETRYABLE vs TERMINAL, and it is the same one
// the One Active Deal rule needs: a retryable failure leaves the client's attempt
// alive so they can correct it on the session they already have, while a terminal
// one must release the deal's live-payment slot or the client is locked out of
// paying by a session that can never succeed.
// ---------------------------------------------------------------------------

/**
 * Codes where the CLIENT can fix it by trying the same OTP prompt again. Only
 * mistyping qualifies — everything else means this attempt is over.
 *
 *   -102  Неправильный ОТП код
 *   -137  Введен неправильный код подтверждения
 */
const RETRYABLE_CODES = new Set(['-102', '-137']);

/**
 * Pulls Plum's numeric error code out of whatever parsePlumError produced.
 *
 * Reads the parsed body first and falls back to the i18n key, because the two
 * are built from the same field and either can be missing depending on how the
 * vendor failed (a gateway 502 has no body at all).
 */
export function plumErrorCode(err: unknown): string | null {
  const e = err as { body?: { error?: { errorCode?: unknown } }; message?: string } | null;
  const raw = e?.body?.error?.errorCode;
  if (raw !== undefined && raw !== null && raw !== '') return String(raw);

  const key = e?.message;
  if (typeof key === 'string' && key.startsWith('plumIntegrationErrors.')) {
    const code = key.slice('plumIntegrationErrors.'.length);
    return code && code !== 'undefined' ? code : null;
  }
  return null;
}

/**
 * True when the client should be allowed another go at the SAME session.
 *
 * Unknown codes are deliberately NOT retryable. An unrecognised vendor failure is
 * the case we understand least, and the safe reading of "we do not know what
 * happened" is to end the attempt and free the deal — a client who has to start
 * over has lost an SMS, whereas a client whose deal is pinned by an immortal
 * session cannot pay at all.
 */
export function isRetryablePlumError(err: unknown): boolean {
  const code = plumErrorCode(err);
  return code !== null && RETRYABLE_CODES.has(code);
}
