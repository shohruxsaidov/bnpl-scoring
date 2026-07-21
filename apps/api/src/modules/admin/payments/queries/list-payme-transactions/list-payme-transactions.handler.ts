import { and, desc, eq, type SQL } from 'drizzle-orm';
import { db } from '@db';
import { deals, paymeTransactions } from '../../../../deals/schema';
import { users } from '@db/schema';

// ---------------------------------------------------------------------------
// Payme protocol state, read-only.
//
// deal_payments answers "what did this client pay". This answers the questions
// that surface only when something is wrong: a transaction stuck pending, a
// timeout, a deal that Payme thinks was paid and we do not.
//
// Deliberately no write endpoints. Hand-editing a transaction row would put our
// state machine out of step with Payme's, and Payme's is the one that gets
// reconciled against. A genuine mismatch is fixed by a support ticket plus, if
// money really did arrive, a manual payment — which lands in the ledger with an
// admin's name attached, as it should.
// ---------------------------------------------------------------------------

export interface PaymeTransactionRow {
  id: string;
  paymeId: string;
  dealId: string;
  dealNumber: string;
  clientName: string | null;
  amount: number;
  state: number;
  reason: number | null;
  createTime: string;
  performTime: string | null;
  cancelTime: string | null;
  paymentId: string | null;
}

export interface ListPaymeTransactionsParams {
  state?: number;
  dealId?: string;
  limit?: number;
}

const msToIso = (ms: number | null | undefined): string | null =>
  ms && ms > 0 ? new Date(ms).toISOString() : null;

export async function listPaymeTransactions(
  params: ListPaymeTransactionsParams = {},
): Promise<PaymeTransactionRow[]> {
  const conditions: SQL[] = [];
  if (params.state !== undefined) conditions.push(eq(paymeTransactions.state, params.state));
  if (params.dealId) conditions.push(eq(paymeTransactions.dealId, params.dealId));

  const rows = await db
    .select({
      id: paymeTransactions.id,
      paymeId: paymeTransactions.paymeId,
      dealId: paymeTransactions.dealId,
      dealNumber: deals.dealNumber,
      firstName: users.firstName,
      lastName: users.lastName,
      amount: paymeTransactions.amountSom,
      state: paymeTransactions.state,
      reason: paymeTransactions.reason,
      createTime: paymeTransactions.createTime,
      performTime: paymeTransactions.performTime,
      cancelTime: paymeTransactions.cancelTime,
      paymentId: paymeTransactions.paymentId,
    })
    .from(paymeTransactions)
    .innerJoin(deals, eq(paymeTransactions.dealId, deals.id))
    .leftJoin(users, eq(users.id, deals.userId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(paymeTransactions.createTime))
    .limit(params.limit ?? 200);

  return rows.map((r) => ({
    id: String(r.id),
    paymeId: r.paymeId,
    dealId: r.dealId,
    dealNumber: String(r.dealNumber),
    clientName: r.firstName ? `${r.firstName} ${r.lastName}` : null,
    amount: Number(r.amount),
    state: r.state,
    reason: r.reason ?? null,
    createTime: new Date(r.createTime).toISOString(),
    performTime: msToIso(r.performTime),
    cancelTime: msToIso(r.cancelTime),
    paymentId: r.paymentId != null ? String(r.paymentId) : null,
  }));
}
