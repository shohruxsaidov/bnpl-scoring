import { eq } from 'drizzle-orm';
import { db } from '@db';
import type { ClientActionType } from '@db/client-actions';
import { dealSessions } from '../../../../deals/schema';
import { recordActionTx } from '../../../../client/actions/service';
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
 * Persist a patched stepData block AND its client-actions row atomically.
 *
 * The transaction is the point. Everything else in this file is a mirror of some
 * durable fact, but these signing rows are the ONLY record that survives: the
 * stamp below is deleted on rejection and overwritten on a re-scan, and `deals`
 * never copied it. If the action insert were best-effort and failed, nothing
 * anywhere would say the client ever proved themselves or ever consented — so
 * this one is allowed to fail the request.
 *
 * No dedupe key: every attempt is a row. A client who scans, is rejected, and
 * scans again did that twice, and flattening it would erase the history this
 * table exists to hold.
 */
async function writeStepDataWithAction(
  session: DealSessionRow,
  next: Record<string, unknown>,
  action: Extract<ClientActionType, 'deal_sign_myid' | 'deal_sign_otp' | 'deal_sign_reject'>,
  occurredAt: Date,
  channel: SigningChannel,
): Promise<DealSessionRow> {
  return await db.transaction(async (tx) => {
    const [row] = await tx
      .update(dealSessions)
      .set({ stepData: next, updatedAt: new Date() })
      .where(eq(dealSessions.id, session.id))
      .returning();

    // A run without a client cannot be recorded: this table is client-keyed, and
    // signing is unreachable before the Клиент step anyway.
    if (session.userId) {
      await recordActionTx(tx, {
        userId: session.userId,
        action,
        status: 'success',
        actorType: 'client',
        actorId: session.agentId,
        merchantId: session.merchantId,
        channel,
        dealSessionId: session.id,
        occurredAt,
      });
    }
    return row!;
  });
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
  await writeStepDataWithAction(
    session,
    { ...stepDataOf(session), signing: stamp },
    'deal_sign_myid',
    // The stamp's own instant, not a second `new Date()`. myid and otp can land
    // in the same second, and the tab showing акцепт above the face-scan would
    // read as the client consenting before identifying themselves.
    new Date(stamp.myidVerifiedAt),
    channel,
  );
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
  await writeStepDataWithAction(
    session,
    { ...data, signing: stamp },
    'deal_sign_otp',
    new Date(stamp.otpVerifiedAt!),
    stamp.channel!,
  );
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
  // Recorded BECAUSE the proofs are being destroyed on the next line. A run
  // refused three times before it was accepted should not read as one accepted
  // first time — and after this delete, the action row is all that is left.
  await writeStepDataWithAction(
    session,
    next,
    'deal_sign_reject',
    new Date(request.rejectedAt!),
    data.signing?.channel ?? 'remote',
  );
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
