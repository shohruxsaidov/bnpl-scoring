import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { computeTermsHash } from '../../../../deals/signing/terms';
import {
  err,
  stepDataOf,
  type DealSessionRow,
  type SigningChannel,
  type SigningRequestState,
  type SigningStamp,
} from '../../types';

/** Persist a patched stepData block and return the fresh session row. */
async function writeStepData(
  session: DealSessionRow,
  next: Record<string, unknown>,
): Promise<DealSessionRow> {
  const [row] = await db
    .update(dealSessions)
    .set({ stepData: next, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id))
    .returning();
  return row!;
}

/**
 * Record that the session's client passed the MyID face-scan. A (re)scan resets
 * the whole block: an earlier OTP consent was paired with the earlier scan, so it
 * cannot carry over to a new identity proof.
 */
export async function stampMyidSigning(
  session: DealSessionRow,
  pinfl: string,
  channel: SigningChannel = 'counter',
): Promise<SigningStamp> {
  const stamp: SigningStamp = { pinfl, myidVerifiedAt: new Date().toISOString(), channel };
  await writeStepData(session, { ...stepDataOf(session), signing: stamp });
  return stamp;
}

/**
 * Record the client's OTP consent — the акцепт, and the last act before the Deal.
 *
 * The terms digest is computed HERE, server-side, at the instant consent is given.
 * It is not accepted from the caller and not read back from an earlier stamp: this
 * is the one moment where "what the client agreed to" is a fact rather than an
 * assumption, and createDealFromSession recomputes it to check nothing moved since.
 */
export async function stampOtpSigning(
  session: DealSessionRow,
  channel?: SigningChannel,
): Promise<SigningStamp> {
  const data = stepDataOf(session);
  // The OTP endpoints gate on a fresh MyID stamp, so this is a guard against a
  // future caller that forgets to, not a reachable path today.
  if (!data.signing) throw err('myid_not_verified');

  const termsHash = computeTermsHash(data);
  if (!termsHash) throw err('session_incomplete');

  const stamp: SigningStamp = {
    ...data.signing,
    otpVerifiedAt: new Date().toISOString(),
    termsHash,
    channel: channel ?? data.signing.channel ?? 'counter',
  };
  await writeStepData(session, { ...data, signing: stamp });
  return stamp;
}

/**
 * Open (or re-open) a request for the client to sign on their own phone. Clearing the
 * previous rejection is the whole point of a re-send: the Agent has changed something
 * and is asking again.
 *
 * Proofs already earned are deliberately LEFT ALONE. They are TTL'd, they are about
 * the same person and the same run, and saveStep has already dropped them if the
 * terms moved — so a client who passed the face-scan at the counter and is now being
 * handed the акцепт on their phone should not have to scan twice. Re-sending is an
 * invitation, not a reset.
 */
export async function stampSigningRequest(session: DealSessionRow): Promise<SigningRequestState> {
  const data = stepDataOf(session);
  const request: SigningRequestState = {
    sentAt: new Date().toISOString(),
    sends: (data.signingRequest?.sends ?? 0) + 1,
  };
  await writeStepData(session, { ...data, signingRequest: request });
  return request;
}

/** The client tapped Отклонить. Recoverable: the run stays `active`, the proofs go. */
export async function rejectSigningRequest(session: DealSessionRow): Promise<SigningRequestState> {
  const data = stepDataOf(session);
  const request: SigningRequestState = {
    sentAt: data.signingRequest?.sentAt ?? new Date().toISOString(),
    sends: data.signingRequest?.sends ?? 1,
    rejectedAt: new Date().toISOString(),
  };
  const next = { ...data, signingRequest: request };
  delete (next as Record<string, unknown>)['signing'];
  await writeStepData(session, next);
  return request;
}

/**
 * Withdraw an outstanding remote request — the Agent gave up waiting and is taking
 * the client through the gate at the counter instead. Proofs already earned on the
 * phone are KEPT: they are the same two proofs either way, stamped on the same run,
 * and making the client re-scan because the Agent changed their mind about the
 * surface would be a tax on nothing.
 */
export async function clearSigningRequest(session: DealSessionRow): Promise<void> {
  const data = stepDataOf(session);
  if (!data.signingRequest) return;
  const next = { ...data };
  delete (next as Record<string, unknown>)['signingRequest'];
  await writeStepData(session, next);
}
