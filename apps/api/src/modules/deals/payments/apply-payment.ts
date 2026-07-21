import { and, asc, eq, sql } from 'drizzle-orm';
import type { db } from '@db';
import {
  deals,
  dealPaymentSchedules,
  dealPayments,
  paymentAllocations,
  type DealPaymentSource,
} from '../schema';

// ---------------------------------------------------------------------------
// The one place a Deal's instalments are settled.
//
// Every rail — an admin recording an MIB transfer, Payme performing a
// transaction — funnels through applyPayment(). Two rails with two allocators
// would drift on the questions that matter (what counts as overpayment, when a
// deal closes, whether a partially-covered instalment is `paid`), and the drift
// would only surface as a client who owes money the system thinks is settled.
//
// Allocation is FIFO by dueDate: the oldest unpaid instalment is filled first,
// partially if the money runs out. Money is som throughout; callers converting
// from another unit do it before they get here.
// ---------------------------------------------------------------------------

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Som are 2dp. Float arithmetic on them drifts; every result is snapped back. */
const round2 = (n: number) => Math.round(n * 100) / 100;

export class OverpaymentError extends Error {
  readonly code = 'OVERPAYMENT';
  readonly statusCode = 400;
  constructor(
    readonly attempted: number,
    readonly remaining: number,
  ) {
    super(`payment of ${attempted} exceeds remaining debt of ${remaining}`);
    this.name = 'OverpaymentError';
  }
}

export interface ApplyPaymentInput {
  dealId: string;
  /** In som. */
  amount: number;
  source: DealPaymentSource;
  /** Human sub-kind for manual rows ('mib' | 'transfer'); rails write their own name. */
  paymentType: string;
  /** The admin who recorded it. Null for machine-booked payments. */
  adminUserId?: number | null;
  note?: string | null;
  /** Tag appended to deal_payment_schedules.paymentProvider on every touched row. */
  provider: string;
}

export interface ApplyPaymentResult {
  paymentId: number;
  createdAt: Date;
  /** True when this payment settled the final instalment and closed the Deal. */
  dealClosed: boolean;
}

/**
 * Total som still owed on a Deal: the sum of every instalment's unpaid part.
 *
 * This is the ceiling on any single payment. Read it inside the same
 * transaction that writes, and — for rails where time passes between quoting an
 * amount and collecting it — read it again at collection time. Between a Payme
 * CheckPerformTransaction and its PerformTransaction, hours can pass and an
 * admin can record an MIB payment that shrinks the debt underneath the payer.
 */
export async function getRemainingDebt(tx: Tx, dealId: string): Promise<number> {
  const rows = await tx
    .select({ amount: dealPaymentSchedules.amount, paidAmount: dealPaymentSchedules.paidAmount })
    .from(dealPaymentSchedules)
    .where(and(eq(dealPaymentSchedules.dealId, dealId), eq(dealPaymentSchedules.paid, false)));

  return round2(rows.reduce((sum, r) => sum + (r.amount - (r.paidAmount ?? 0)), 0));
}

/**
 * Book a payment and settle instalments FIFO.
 *
 * Must be called inside a transaction that already holds a row lock on the Deal
 * (`SELECT ... FOR UPDATE`), otherwise two concurrent payments can each read the
 * same remaining debt and both pass the overpayment check.
 *
 * Throws OverpaymentError when the amount exceeds the remaining debt. There is
 * no credit balance and no reversal, so accepting an overpayment would strand
 * money with no mechanism to return it.
 */
export async function applyPayment(tx: Tx, input: ApplyPaymentInput): Promise<ApplyPaymentResult> {
  const amount = round2(input.amount);
  if (!(amount > 0)) throw new Error('payment amount must be positive');

  const unpaid = await tx
    .select()
    .from(dealPaymentSchedules)
    .where(
      and(eq(dealPaymentSchedules.dealId, input.dealId), eq(dealPaymentSchedules.paid, false)),
    )
    .orderBy(asc(dealPaymentSchedules.dueDate));

  const remaining = round2(unpaid.reduce((sum, r) => sum + (r.amount - (r.paidAmount ?? 0)), 0));
  if (amount > remaining) throw new OverpaymentError(amount, remaining);

  const [payment] = await tx
    .insert(dealPayments)
    .values({
      dealId: input.dealId,
      adminUserId: input.adminUserId ?? null,
      amount,
      source: input.source,
      paymentType: input.paymentType,
      note: input.note || null,
    })
    .returning();
  const booked = payment!;

  let bucket = amount;
  const now = new Date();

  for (const row of unpaid) {
    if (bucket <= 0) break;
    const rowRemaining = round2(row.amount - (row.paidAmount ?? 0));
    const apply = round2(bucket < rowRemaining ? bucket : rowRemaining);
    const newPaid = round2((row.paidAmount ?? 0) + apply);
    // >= rather than === : rounding must never leave an instalment a hundredth
    // of a som short and therefore permanently unpaid.
    const fullyPaid = newPaid >= row.amount;

    await tx
      .update(dealPaymentSchedules)
      .set({
        paidAmount: newPaid,
        paid: fullyPaid,
        paidAt: fullyPaid ? now : null,
        manualPaymentId: booked.id,
        paymentProvider: sql`array_append(COALESCE(${dealPaymentSchedules.paymentProvider}, ARRAY[]::text[]), ${input.provider})`,
      })
      .where(eq(dealPaymentSchedules.id, row.id));

    // The exact split. Unread today; unreconstructable later if not written now.
    await tx.insert(paymentAllocations).values({
      paymentId: booked.id,
      scheduleId: row.id,
      amount: apply,
    });

    bucket = round2(bucket - apply);
  }

  const stillUnpaid = await tx
    .select({ id: dealPaymentSchedules.id })
    .from(dealPaymentSchedules)
    .where(
      and(eq(dealPaymentSchedules.dealId, input.dealId), eq(dealPaymentSchedules.paid, false)),
    )
    .limit(1);

  const dealClosed = stillUnpaid.length === 0;
  if (dealClosed) {
    // Closing frees the client's One Active Deal slot (deals_user_active_idx) —
    // they can open a new deal the moment this commits.
    await tx.update(deals).set({ status: 'closed' }).where(eq(deals.id, input.dealId));
  }

  return { paymentId: booked.id, createdAt: booked.createdAt, dealClosed };
}

/**
 * Lock a Deal row for the duration of the transaction. Every writer of
 * instalments takes this first, so the read of remaining debt and the write that
 * consumes it cannot interleave with another rail's.
 *
 * Returns null when the Deal does not exist.
 */
export async function lockDeal(tx: Tx, dealId: string) {
  const rows = await tx
    .select()
    .from(deals)
    .where(eq(deals.id, dealId))
    .for('update')
    .limit(1);
  return rows[0] ?? null;
}
