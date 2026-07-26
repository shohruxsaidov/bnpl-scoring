import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@db';
import {
  clientActions,
  type ClientActionActor,
  type ClientActionChannel,
  type ClientActionStatus,
  type ClientActionType,
} from '@db/client-actions';

/** A transaction handle, for the callers that must not lose their row. */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface RecordActionInput {
  userId: number;
  action: ClientActionType;
  status: ClientActionStatus;
  /** Why a failure failed. Never set on a success. */
  reasonCode?: string | null;
  actorType: ClientActionActor;
  /** merchant_users.id — required in practice when actorType is 'agent'. */
  actorId?: number | null;
  merchantId?: number | null;
  channel?: ClientActionChannel | null;
  dealSessionId?: string | null;
  dealId?: string | null;
  scoringId?: number | null;
  userCardId?: number | null;
  /**
   * Opt-in idempotency, e.g. 'scoring:<scoringId>'. Omit to allow repeats — the
   * signing gates want every attempt, a re-added card is a real second event.
   */
  dedupeKey?: string | null;
  /**
   * Domain time. Pass the stamp's own timestamp where one exists (the signing
   * gates carry an ISO string) rather than letting it default, so myid and otp
   * cannot land out of order when they fall in the same second.
   */
  occurredAt?: Date;
}

function toValues(input: RecordActionInput) {
  return {
    userId: input.userId,
    action: input.action,
    status: input.status,
    reasonCode: input.reasonCode ?? null,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    merchantId: input.merchantId ?? null,
    channel: input.channel ?? null,
    dealSessionId: input.dealSessionId ?? null,
    dealId: input.dealId ?? null,
    scoringId: input.scoringId ?? null,
    userCardId: input.userCardId ?? null,
    dedupeKey: input.dedupeKey ?? null,
    ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
  };
}

/**
 * Record a client milestone. BY CONTRACT THIS NEVER THROWS: adding a card is not
 * allowed to fail because an audit insert did. By the time most callers reach
 * here the real work is already done and irreversible — the card exists at
 * Plumgate whether or not this row lands — and answering "card not added" about
 * a card that WAS added is a worse failure than a missing row.
 *
 * Use recordActionTx instead where the row is the only evidence that survives.
 */
export async function recordAction(input: RecordActionInput): Promise<void> {
  try {
    await db.insert(clientActions).values(toValues(input)).onConflictDoNothing({
      target: clientActions.dedupeKey,
    });
  } catch (err) {
    console.error('[client-actions] recordAction failed', input.action, err);
  }
}

/**
 * Record inside the caller's transaction — and let a failure take the request
 * down with it.
 *
 * Reserved for registration and the signing gates, where this row is the SOURCE
 * OF TRUTH rather than a mirror of one: deal_sessions.step_data.signing is
 * deleted on rejection and overwritten on a re-scan, so if this insert is lost
 * there is nothing anywhere saying the client ever consented. "We lost the
 * record that they agreed" is a different class of failure from "we lost a push
 * notification", and it should not be swallowed.
 */
export async function recordActionTx(tx: Tx, input: RecordActionInput): Promise<void> {
  await tx.insert(clientActions).values(toValues(input)).onConflictDoNothing({
    target: clientActions.dedupeKey,
  });
}

/**
 * Best-effort reason code for a vendor failure.
 *
 * Plumgate and MyID surface HTTP status codes, not a stable error vocabulary, so
 * there is nothing to map to a tidy enum. `plumgate_400` is deliberately raw: the
 * admin portal renders unknown codes verbatim, and an untranslated code still
 * tells support which vendor said no, which is more than a blank cell does.
 */
export function vendorReasonCode(err: unknown, fallback: string): string {
  const e = err as { name?: string; integration?: string; statusCode?: number; code?: string };
  if (typeof e?.code === 'string' && e.code) return e.code.slice(0, 40);
  if (e?.name === 'IntegrationError' && e.integration) {
    return `${e.integration}_${e.statusCode ?? 'error'}`.slice(0, 40);
  }
  return fallback;
}

/**
 * Point this session's signing rows at the Deal they ended up producing.
 *
 * Called from deal creation, inside its existing transaction. Signing happens on
 * a deal_session and the Deal does not exist yet, so the rows are written with a
 * null dealId and stamped here — which is what makes them clickable in the admin
 * tab, since deal sessions have no admin page of their own. Only rows still
 * unstamped are touched, so a session that somehow produced two deals cannot
 * rewrite the first one's history.
 */
export async function stampDealOnSigningActions(
  tx: Tx,
  dealSessionId: string,
  dealId: string,
): Promise<void> {
  await tx
    .update(clientActions)
    .set({ dealId })
    .where(and(eq(clientActions.dealSessionId, dealSessionId), isNull(clientActions.dealId)));
}
