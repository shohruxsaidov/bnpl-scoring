import { redis } from '@redis';
import { createOtp, deleteOtps, verifyOtp } from '../../auth/client/service/service.handler';
import { sendOtpSms } from '../../../lib/sms';

// ---------------------------------------------------------------------------
// The акцепт code — issuing and spending it, with the guards the deal-signing
// routes were missing.
//
// The code is 4 digits (10k). Before this module, /sign-otp/verify had no attempt
// counter, no route rate limit, and a resend cooldown that lived only in the Vue
// component — so the server would mint fresh codes as fast as they were asked
// for, and each one could be guessed at the global limiter's pace for its whole
// 5-minute life. The one party holding both the session and a motive is the Agent,
// and in the remote flow the client is no longer watching their own SMS arrive.
//
// Three bounds, and it takes all three:
//   • attempts  — guesses against ONE live code; spending them BURNS the code, so
//                 waiting out a rate-limit window can't resume against it.
//   • cooldown  — 60s between sends to a phone (the number the Vue timer showed).
//   • sends     — a hard cap per session, which is what stops "resend until one of
//                 the 5% windows lands".
// ---------------------------------------------------------------------------

export const SIGNING_OTP_COOLDOWN_SECONDS = 60;

/** Guesses allowed against a single live code before it is burned. */
export const SIGNING_OTP_MAX_ATTEMPTS = 5;

/**
 * Codes a single Wizard run may ever send. Five covers a mistyped number, a slow
 * SMS and a genuine resend; past that the client isn't receiving them and the
 * Agent should be falling back, not hammering. Cheap resends are what turn a 5%
 * per-code guess into a near-certainty across codes.
 */
export const SIGNING_OTP_MAX_SENDS = 5;

/** Mirrors createOtp's row lifetime — bounds the guess counter to the code it guards. */
const OTP_TTL_SECONDS = 5 * 60;

/** Sends are counted per RUN, so the cap can't be reset by re-picking the client. */
const SENDS_TTL_SECONDS = 12 * 60 * 60;

/**
 * Same key shape the client auth flows use (`client:otp:attempts:{purpose}:{phone}`),
 * so `deal_signing` gets its own budget without colliding with a live password- or
 * PIN-reset code for the same phone.
 */
function attemptKey(phone: string): string {
  return `client:otp:attempts:deal_signing:${phone}`;
}

function cooldownKey(phone: string): string {
  return `deal:signing:otp:cooldown:${phone}`;
}

function sendsKey(sessionId: string): string {
  return `deal:signing:otp:sends:${sessionId}`;
}

export interface IssueSigningOtpResult {
  code?: string;
  error?: 'cooldown' | 'send_cap';
  seconds?: number;
}

/**
 * Mint the акцепт code, SMS it, and charge it against the run's send budget.
 *
 * The cooldown is checked before the counter is spent, so a throttled caller does
 * not burn one of their five sends. A fresh code clears the guess budget: the daily
 * send cap is what bounds brute force ACROSS codes, so refusing a legitimate retry
 * after a genuinely mistyped code would buy nothing.
 */
export async function issueSigningOtp(
  phone: string,
  sessionId: string,
): Promise<IssueSigningOtpResult> {
  const cdKey = cooldownKey(phone);
  const onCooldown = await redis.get(cdKey).catch(() => null);
  if (onCooldown) {
    const ttl = await redis.ttl(cdKey).catch(() => SIGNING_OTP_COOLDOWN_SECONDS);
    return { error: 'cooldown', seconds: ttl > 0 ? ttl : SIGNING_OTP_COOLDOWN_SECONDS };
  }

  const sKey = sendsKey(sessionId);
  const sends = await redis.incr(sKey).catch(() => 0);
  if (sends === 1) await redis.expire(sKey, SENDS_TTL_SECONDS).catch(() => undefined);
  if (sends > SIGNING_OTP_MAX_SENDS) return { error: 'send_cap' };

  const code = await createOtp(phone, 'deal_signing');
  await redis.set(cdKey, '1', 'EX', SIGNING_OTP_COOLDOWN_SECONDS).catch(() => undefined);
  await redis.del(attemptKey(phone)).catch(() => undefined);

  // The one thing the old route never did: actually deliver the code. It called
  // createOtp() and returned devOtp in non-prod, so in production the акцепт code
  // was issued to nobody and deal signing could not complete at all.
  await sendOtpSms(phone, code);

  return { code };
}

export type VerifySigningOtpResult = 'ok' | 'invalid' | 'attempts_exceeded';

/** Spend a guess against the live акцепт code. The budget burns the code when exhausted. */
export async function verifySigningOtp(
  phone: string,
  code: string,
): Promise<VerifySigningOtpResult> {
  const key = attemptKey(phone);
  const attempts = Number((await redis.get(key).catch(() => null)) ?? 0);
  if (attempts >= SIGNING_OTP_MAX_ATTEMPTS) return 'attempts_exceeded';

  if (await verifyOtp(phone, code, 'deal_signing')) {
    await redis.del(key).catch(() => undefined);
    return 'ok';
  }

  const spent = await redis.incr(key).catch(() => 0);
  if (spent === 1) await redis.expire(key, OTP_TTL_SECONDS).catch(() => undefined);
  if (spent >= SIGNING_OTP_MAX_ATTEMPTS) {
    await deleteOtps(phone, 'deal_signing');
    return 'attempts_exceeded';
  }
  return 'invalid';
}

/** Drop a run's signing-OTP state — its live code, guess budget and send count. */
export async function clearSigningOtpState(phone: string, sessionId: string): Promise<void> {
  await deleteOtps(phone, 'deal_signing');
  await redis.del(attemptKey(phone), sendsKey(sessionId)).catch(() => undefined);
}
