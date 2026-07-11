import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { err, stepDataOf, type DealSessionRow, type SigningStamp } from '../../types';

/**
 * Record that the session's client passed the MyID face-scan. A (re)scan resets
 * the whole block: an earlier OTP consent was paired with the earlier scan, so it
 * cannot carry over to a new identity proof.
 */
export async function stampMyidSigning(
  session: DealSessionRow,
  pinfl: string,
): Promise<SigningStamp> {
  const stamp: SigningStamp = { pinfl, myidVerifiedAt: new Date().toISOString() };
  const data = stepDataOf(session);
  await db
    .update(dealSessions)
    .set({ stepData: { ...data, signing: stamp }, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
  return stamp;
}

/** Record the client's OTP consent — the акцепт, and the last act before the Deal. */
export async function stampOtpSigning(session: DealSessionRow): Promise<SigningStamp> {
  const data = stepDataOf(session);
  // The OTP endpoints gate on a fresh MyID stamp, so this is a guard against a
  // future caller that forgets to, not a reachable path today.
  if (!data.signing) throw err('myid_not_verified');

  const stamp: SigningStamp = { ...data.signing, otpVerifiedAt: new Date().toISOString() };
  await db
    .update(dealSessions)
    .set({ stepData: { ...data, signing: stamp }, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
  return stamp;
}
