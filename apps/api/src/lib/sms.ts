import { env } from '@env';

/**
 * Deliver an OTP code to a phone over SMS.
 *
 * ⚠️ LAUNCH BLOCKER: this is a stub seam. No real SMS provider is wired yet.
 * In non-production it only logs the code (callers also surface it as `devOtp`).
 * In production it currently throws so codes are never silently issued to a
 * recipient that never receives them — replace the body with a real provider
 * (Eskiz / Play Mobile) before go-live, keeping this signature intact.
 */
export async function sendOtpSms(phone: string, code: string): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('sendOtpSms: no SMS provider configured');
  }
  // eslint-disable-next-line no-console
  console.info(`[sms:stub] OTP for ${phone}: ${code}`);
}
