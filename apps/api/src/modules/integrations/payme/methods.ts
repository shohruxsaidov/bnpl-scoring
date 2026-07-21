import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@db';
import {
  paymeTransactions,
  PAYME_STATE,
  PAYME_CANCEL_REASON,
  PAYME_TIMEOUT_MS,
} from '@db/payme-transactions';
import { applyPayment, lockDeal, OverpaymentError } from '../../deals/payments/apply-payment';
import { assertAmountAcceptable, resolveAccount } from './account';
import { paymeErrors } from './errors';
import { toSom, type PaymeAccount } from './protocol';
import { enqueuePaymentReceivedPush } from './notify';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
type PaymeTransaction = typeof paymeTransactions.$inferSelect;

// ---------------------------------------------------------------------------
// The six Merchant API methods.
//
// Every one of them is idempotent on params.id, because Payme retries on any
// non-answer and its sandbox replays each call deliberately. The dangerous one
// is PerformTransaction: re-running the allocator on a replay would credit the
// deal twice, and with reversal out of scope that is unrecoverable. So Perform
// reads state first and returns the ORIGINAL perform_time when the work is
// already done.
// ---------------------------------------------------------------------------

const asString = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''));

/** Postgres unique_violation, narrowed to one index by name. */
function isUniqueViolation(err: unknown, constraint: string): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const e = err as { code?: string; constraint_name?: string; message?: string };
  if (e.code !== '23505') return false;
  // postgres-js exposes constraint_name; fall back to the message when a driver
  // upgrade stops populating it, since the alternative is silently mis-handling.
  return e.constraint_name === constraint || (e.message?.includes(constraint) ?? false);
}

function requireTransactionId(params: Record<string, unknown>): string {
  const id = asString(params['id']).trim();
  if (!id) throw paymeErrors.transactionNotFound();
  return id;
}

function requireAmountTiyin(params: Record<string, unknown>): number {
  const raw = params['amount'];
  return typeof raw === 'number' ? raw : Number(raw);
}

function accountOf(params: Record<string, unknown>): PaymeAccount {
  const account = params['account'];
  if (typeof account !== 'object' || account === null) throw paymeErrors.dealNotFound();
  return account as PaymeAccount;
}

async function loadTransaction(tx: Tx, paymeId: string): Promise<PaymeTransaction | null> {
  const rows = await tx
    .select()
    .from(paymeTransactions)
    .where(eq(paymeTransactions.paymeId, paymeId))
    .limit(1);
  return rows[0] ?? null;
}

/** Is this pending transaction past Payme's 12-hour life? */
function isExpired(row: PaymeTransaction, now: number): boolean {
  return row.state === PAYME_STATE.CREATED && now - row.createTime > PAYME_TIMEOUT_MS;
}

/**
 * Kill an expired pending transaction with reason 4.
 *
 * The lazy half of timeout enforcement — driven by whatever call happens to
 * arrive next. It cannot be the only half: an abandoned transaction gets no
 * further calls (Payme has no reason to make one) yet still holds the
 * one-pending-per-deal lock, so the client would be unable to pay at all. The
 * sweeper in ./sweep.ts is what actually frees them.
 */
async function expire(tx: Tx, row: PaymeTransaction, now: number): Promise<PaymeTransaction> {
  const [updated] = await tx
    .update(paymeTransactions)
    .set({
      state: PAYME_STATE.CANCELLED,
      reason: PAYME_CANCEL_REASON.TIMEOUT,
      cancelTime: now,
      updatedAt: new Date(),
    })
    .where(eq(paymeTransactions.id, row.id))
    .returning();
  return updated!;
}

/* ── CheckPerformTransaction ─────────────────────────────────────────────────
 * Runs before the payer sees a confirm screen, so its errors are the UX: this
 * is where a mistyped deal number gets explained. Read-only.
 */
export async function checkPerformTransaction(params: Record<string, unknown>) {
  return db.transaction(async (tx) => {
    const account = await resolveAccount(tx, accountOf(params));
    assertAmountAcceptable(toSom(requireAmountTiyin(params)), account.remaining);
    await assertNoPending(tx, account.dealId);
    return { allow: true };
  });
}

/**
 * One pending transaction per deal. The database index is what actually holds
 * the line under concurrency; this check exists to answer with a comprehensible
 * error instead of a unique-violation.
 */
async function assertNoPending(tx: Tx, dealId: string, exceptPaymeId?: string): Promise<void> {
  const rows = await tx
    .select({ paymeId: paymeTransactions.paymeId })
    .from(paymeTransactions)
    .where(
      and(eq(paymeTransactions.dealId, dealId), eq(paymeTransactions.state, PAYME_STATE.CREATED)),
    )
    .limit(1);

  const pending = rows[0];
  if (!pending) return;
  if (exceptPaymeId && pending.paymeId === exceptPaymeId) return;
  throw paymeErrors.dealPendingPayment();
}

/* ── CreateTransaction ───────────────────────────────────────────────────────
 * Reserves the payment. Nothing reaches the ledger here — the row lives only in
 * payme_transactions until Perform.
 */
const IDX_PAYME_ID = 'payme_transactions_payme_id_uq';
const IDX_DEAL_PENDING = 'payme_transactions_deal_pending_uq';

async function attemptCreate(params: Record<string, unknown>, paymeId: string) {
  const paymeTime = Number(params['time']) || Date.now();
  const amountTiyin = requireAmountTiyin(params);

  return db.transaction(async (tx) => {
    const existing = await loadTransaction(tx, paymeId);
    const now = Date.now();

    if (existing) {
      // A replay. Answer from the row rather than creating a second one.
      if (isExpired(existing, now)) {
        await expire(tx, existing, now);
        throw paymeErrors.cannotPerform();
      }
      if (existing.state !== PAYME_STATE.CREATED) throw paymeErrors.cannotPerform();
      return {
        create_time: existing.createTime,
        transaction: String(existing.id),
        state: existing.state,
      };
    }

    const account = await resolveAccount(tx, accountOf(params));
    // Lock before the pending check so two concurrent creates on the same deal
    // cannot both find it free.
    await lockDeal(tx, account.dealId);
    const amountSom = assertAmountAcceptable(toSom(amountTiyin), account.remaining);
    await assertNoPending(tx, account.dealId, paymeId);

    const [created] = await tx
      .insert(paymeTransactions)
      .values({
        paymeId,
        dealId: account.dealId,
        amountTiyin,
        amountSom,
        account: accountOf(params),
        state: PAYME_STATE.CREATED,
        paymeTime,
        createTime: now,
      })
      .returning();

    return { create_time: created!.createTime, transaction: String(created!.id), state: created!.state };
  });
}

export async function createTransaction(params: Record<string, unknown>) {
  const paymeId = requireTransactionId(params);

  try {
    return await attemptCreate(params, paymeId);
  } catch (err) {
    // Both guards above read before they write, so a request that commits in
    // between beats them; the indexes are what actually hold the line. Their
    // verdicts have to be translated here, OUTSIDE the transaction — a 23505
    // aborts the Postgres transaction, so nothing can be read or retried on the
    // same connection state.
    if (isUniqueViolation(err, IDX_PAYME_ID)) {
      // The same transaction id raced us. Payme asked twice for ONE transaction,
      // so retry in a fresh transaction: the replay branch now finds the row the
      // winner wrote and answers from it.
      return attemptCreate(params, paymeId);
    }
    if (isUniqueViolation(err, IDX_DEAL_PENDING)) throw paymeErrors.dealPendingPayment();
    throw err;
  }
}

/* ── PerformTransaction ──────────────────────────────────────────────────────
 * The only method that moves money. Everything inside the transaction is ledger
 * work; the push is enqueued after commit so a dead FCM cannot roll back a
 * booked payment or hold Payme past its timeout.
 */
export async function performTransaction(params: Record<string, unknown>) {
  const paymeId = requireTransactionId(params);

  const outcome = await db.transaction(async (tx) => {
    const row = await loadTransaction(tx, paymeId);
    if (!row) throw paymeErrors.transactionNotFound();

    // Replay of an already-performed transaction: return the ORIGINAL times.
    // Re-allocating here would double-credit the deal.
    if (row.state === PAYME_STATE.PERFORMED) {
      return {
        response: { transaction: String(row.id), perform_time: row.performTime, state: row.state },
        push: null,
      };
    }

    if (row.state !== PAYME_STATE.CREATED) throw paymeErrors.cannotPerform();

    const now = Date.now();
    if (isExpired(row, now)) {
      await expire(tx, row, now);
      throw paymeErrors.cannotPerform();
    }

    // Re-validate from scratch. Hours can separate Check from Perform, and in
    // that window an admin MIB payment or a deal closure can invalidate
    // everything the payer was quoted.
    await lockDeal(tx, row.dealId);
    const account = await resolveAccount(tx, row.account as PaymeAccount);
    if (account.dealId !== row.dealId) throw paymeErrors.cannotPerform();
    assertAmountAcceptable(row.amountSom, account.remaining);

    let payment;
    try {
      payment = await applyPayment(tx, {
        dealId: row.dealId,
        amount: row.amountSom,
        source: 'payme',
        paymentType: 'payme',
        adminUserId: null,
        note: null,
        provider: 'payme',
      });
    } catch (err) {
      // assertAmountAcceptable should have caught this; if the allocator still
      // says overpayment, the debt moved under us and Payme must be told the
      // amount is wrong rather than handed a -32400.
      if (err instanceof OverpaymentError) throw paymeErrors.invalidAmount();
      throw err;
    }

    const [updated] = await tx
      .update(paymeTransactions)
      .set({
        state: PAYME_STATE.PERFORMED,
        performTime: now,
        paymentId: payment.paymentId,
        updatedAt: new Date(),
      })
      .where(eq(paymeTransactions.id, row.id))
      .returning();

    return {
      response: {
        transaction: String(updated!.id),
        perform_time: updated!.performTime,
        state: updated!.state,
      },
      push: account.userId
        ? { userId: account.userId, paymentId: payment.paymentId, amount: row.amountSom, dealClosed: payment.dealClosed }
        : null,
    };
  });

  if (outcome.push) await enqueuePaymentReceivedPush(outcome.push);
  return outcome.response;
}

/* ── CancelTransaction ───────────────────────────────────────────────────────
 * A pending transaction cancels freely. A PERFORMED one does not: reversal is
 * deliberately out of scope, so state -2 is never written and Payme is told the
 * payment is final. If Payme force-cancels on its side anyway (fraud,
 * chargeback), the divergence surfaces at GetStatement and is settled by hand.
 */
export async function cancelTransaction(params: Record<string, unknown>) {
  const paymeId = requireTransactionId(params);
  const reason = Number(params['reason']) || PAYME_CANCEL_REASON.UNKNOWN;

  return db.transaction(async (tx) => {
    const row = await loadTransaction(tx, paymeId);
    if (!row) throw paymeErrors.transactionNotFound();

    if (row.state === PAYME_STATE.PERFORMED) throw paymeErrors.cannotCancel();

    // Already cancelled — idempotent, keep the original cancel_time and reason.
    if (row.state === PAYME_STATE.CANCELLED) {
      return { transaction: String(row.id), cancel_time: row.cancelTime, state: row.state };
    }

    const [updated] = await tx
      .update(paymeTransactions)
      .set({
        state: PAYME_STATE.CANCELLED,
        reason,
        cancelTime: Date.now(),
        updatedAt: new Date(),
      })
      .where(eq(paymeTransactions.id, row.id))
      .returning();

    return { transaction: String(updated!.id), cancel_time: updated!.cancelTime, state: updated!.state };
  });
}

/* ── CheckTransaction ────────────────────────────────────────────────────────
 * Pure read, except that it is also a chance to notice a timeout — Payme's test
 * suite polls here expecting an expired transaction to have died.
 */
export async function checkTransaction(params: Record<string, unknown>) {
  const paymeId = requireTransactionId(params);

  return db.transaction(async (tx) => {
    let row = await loadTransaction(tx, paymeId);
    if (!row) throw paymeErrors.transactionNotFound();

    const now = Date.now();
    if (isExpired(row, now)) row = await expire(tx, row, now);

    return {
      create_time: row.createTime,
      perform_time: row.performTime,
      cancel_time: row.cancelTime,
      transaction: String(row.id),
      state: row.state,
      reason: row.reason ?? null,
    };
  });
}

/* ── GetStatement ────────────────────────────────────────────────────────────
 * Payme's reconciliation sweep. Returns every transaction created in the window,
 * in whatever state — cancelled ones included, because a statement that hides
 * them looks to Payme like transactions it invented.
 */
export async function getStatement(params: Record<string, unknown>) {
  const from = Number(params['from']);
  const to = Number(params['to']);
  if (!Number.isFinite(from) || !Number.isFinite(to)) throw paymeErrors.internal();

  const rows = await db
    .select()
    .from(paymeTransactions)
    .where(and(gte(paymeTransactions.createTime, from), lte(paymeTransactions.createTime, to)))
    .orderBy(asc(paymeTransactions.createTime));

  return {
    transactions: rows.map((row) => ({
      id: row.paymeId,
      time: row.paymeTime,
      amount: row.amountTiyin,
      account: row.account,
      create_time: row.createTime,
      perform_time: row.performTime,
      cancel_time: row.cancelTime,
      transaction: String(row.id),
      state: row.state,
      reason: row.reason ?? null,
      // No split settlement — the platform is the sole recipient.
      receivers: null,
    })),
  };
}

/**
 * Cancel every pending transaction older than the 12h limit. Called by the
 * sweeper; returns how many it killed.
 */
export async function expireStalePendingTransactions(): Promise<number> {
  const now = Date.now();
  const cutoff = now - PAYME_TIMEOUT_MS;

  const killed = await db
    .update(paymeTransactions)
    .set({
      state: PAYME_STATE.CANCELLED,
      reason: PAYME_CANCEL_REASON.TIMEOUT,
      cancelTime: now,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(paymeTransactions.state, PAYME_STATE.CREATED),
        sql`${paymeTransactions.createTime} < ${cutoff}`,
      ),
    )
    .returning({ id: paymeTransactions.id });

  return killed.length;
}
