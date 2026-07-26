import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '@db';
import { branches, merchants, userDevices, users } from '@db/schema';
import { dealSessions } from '../schema';
import { notify } from '../../client/notifications/service';
import {
  err,
  isSigningProofFresh,
  stepDataOf,
  type DealSessionRow,
  type SigningRequestState,
  type SigningStamp,
} from '../../merchant/deal-sessions/types';
import { buildDealTerms, buildSchedulePreview, type DealTerms } from './terms';

// ---------------------------------------------------------------------------
// Signing — the parts the counter and the phone both stand on.
//
// The run being signed is a DEAL SESSION, not a Deal: no Deal exists until both
// proofs are in and the Agent presses Создать сделку (ADR-0024). So "the deal the
// client is signing" is a session id everywhere below, and the client's app is
// shown a rendering of that session's terms rather than a row it could fetch.
// ---------------------------------------------------------------------------

export interface SigningContext {
  session: DealSessionRow;
  user: { id: number; pinfl: string; phone: string };
  merchantName: string;
  branchName: string;
}

/** Dress a session the caller has already loaded and authorized with who is asking. */
export async function resolveSigningContext(
  session: DealSessionRow,
  user: { id: number; pinfl: string; phone: string },
): Promise<SigningContext> {
  const [row] = await db
    .select({ merchantName: merchants.name, branchName: branches.name })
    .from(dealSessions)
    .leftJoin(merchants, eq(dealSessions.merchantId, merchants.id))
    .leftJoin(branches, eq(dealSessions.branchId, branches.id))
    .where(eq(dealSessions.id, session.id))
    .limit(1);

  return {
    session,
    user,
    merchantName: row?.merchantName ?? '—',
    branchName: row?.branchName ?? '—',
  };
}

/**
 * Load a run for signing, from the CLIENT's side: they may only sign a session
 * that is about them, that is still open, and that they have actually been ASKED
 * to sign.
 *
 * Every failure here is deliberately the same shape. A session belonging to someone
 * else must not be distinguishable from one that never existed — the id is a UUID in
 * a URL, and the answer must not tell a prober whether they guessed right.
 */
export async function loadSigningContext(
  sessionId: string,
  userId: number,
): Promise<SigningContext> {
  const [session] = await db
    .select()
    .from(dealSessions)
    .where(eq(dealSessions.id, sessionId))
    .limit(1);

  if (!session) throw err('signing_request_not_found');

  // Ownership and liveness collapse into one answer. The client's app polls
  // to-sign, so a run the Agent has since abandoned (which happens the moment they
  // open the wizard for the NEXT customer — at most one active session per agent)
  // simply stops being offered, rather than failing loudly on a screen the client
  // is already looking at.
  if (session.userId == null || session.userId !== userId) throw err('signing_request_not_found');
  if (session.status !== 'active') throw err('signing_request_not_found');

  // A run nobody has been asked to sign is not signable from a phone. Without this,
  // any authenticated client could drive the signing endpoints against the Agent's
  // still-open wizard run and consent to terms nobody has finished typing.
  if (!stepDataOf(session).signingRequest || stepDataOf(session).signingRequest?.rejectedAt)
    throw err('signing_request_not_found');

  const [user] = await db
    .select({ id: users.id, pinfl: users.pinfl, phone: users.phone })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);
  if (!user) throw err('signing_request_not_found');

  return resolveSigningContext(session, user);
}

/** Does the client have an app we can actually reach? The gate for offering remote signing. */
export async function hasPushDevice(userId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: userDevices.id })
    .from(userDevices)
    .where(and(eq(userDevices.userId, userId), isNotNull(userDevices.fcmToken)))
    .limit(1);
  return !!row;
}

/**
 * Nudge the client's phone.
 *
 * The dedupe key carries the send counter. `notify()` inserts on-conflict-do-nothing
 * and enqueues the push ONLY when a row was actually inserted — so a key of
 * `deal_signing:<sessionId>` would push once and then silently do nothing forever.
 * That is precisely the re-send after a reject: client declines, Agent drops the
 * tariff, Agent re-sends, and the client's phone stays dark while the Agent watches
 * a spinner. The counter makes every send its own domain event, which it is.
 */
export async function sendSigningRequestPush(
  ctx: SigningContext,
  request: SigningRequestState,
  terms: DealTerms,
): Promise<void> {
  await notify({
    userId: ctx.user.id,
    type: 'deal_signing_request',
    data: {
      dealSessionId: ctx.session.id,
      merchantName: ctx.merchantName,
      // Whole som, grouped — this lands in a push body, not in a calculation.
      totalPayable: Math.round(terms.totalPayable).toLocaleString('ru-RU'),
    },
    dedupeKey: `deal_signing:${ctx.session.id}:${request.sends}`,
  });
}

/**
 * What the client reads before they consent. This IS the disclosure: at the counter
 * the Agent's monitor was doing this job, and remote signing takes that monitor away.
 * Anything the Agent can see about the money, the client sees here.
 */
export function buildSigningRequestDto(
  ctx: SigningContext,
  terms: DealTerms,
  now: Date = new Date(),
) {
  const schedule = buildSchedulePreview(terms, now);
  const data = stepDataOf(ctx.session);
  const signing: SigningStamp | undefined = data.signing;

  return {
    dealSessionId: ctx.session.id,
    merchantName: ctx.merchantName,
    branchName: ctx.branchName,
    requestedAt: data.signingRequest?.sentAt ?? ctx.session.updatedAt.toISOString(),
    terms: {
      tariffName: terms.tariffName,
      termMonths: terms.termMonths,
      markupPercent: terms.markupPercent,
      paymentDay: terms.paymentDay,
      lang: terms.lang,
      amount: terms.amount,
      totalPayable: terms.totalPayable,
      prepaymentAmount: terms.prepaymentAmount,
      // The number the client actually decides on. Instalments are not uniform —
      // the first absorbs the rounding remainder — so this is the real first payment,
      // not totalPayable/termMonths.
      monthlyPayment: schedule[0]?.amount ?? 0,
      basket: terms.lines.map((l) => ({
        productName: l.productName,
        quantity: l.quantity,
        total: l.total,
      })),
    },
    schedule,
    // The gate, read back off the server's own stamps — the phone renders its
    // progress from this rather than remembering where it thought it was.
    signing: {
      myidVerified: isSigningProofFresh(signing?.myidVerifiedAt),
      otpVerified: isSigningProofFresh(signing?.otpVerifiedAt),
    },
  };
}

/** The terms of a run, or a hard failure — a run without complete terms cannot be signed. */
export function requireTerms(session: DealSessionRow): DealTerms {
  const terms = buildDealTerms(stepDataOf(session));
  if (!terms) throw err('session_incomplete');
  return terms;
}
