import { eq, inArray } from 'drizzle-orm';
import { db } from '@db';
import { dealPaymentSchedules } from '@db/schema';

// ---------------------------------------------------------------------------
// Payment progress — derived from deal_payment_schedules. Both the list and
// detail endpoints show a borrower how far along a credit is: how much has
// been paid, how much remains, and the next instalment coming due. The list
// aggregates for many deals in ONE grouped query (no N+1); detail reuses the
// per-deal shape from the same rows it already loads.
// ---------------------------------------------------------------------------

export type DealProgress = {
  paidAmount: number;
  remainingAmount: number;
  nextDueDate: string | null;
  nextDueAmount: number | null;
};

const ZERO: DealProgress = {
  paidAmount: 0,
  remainingAmount: 0,
  nextDueDate: null,
  nextDueAmount: null,
};

// Reduce a deal's instalment rows to the borrower-facing progress totals.
// remainingAmount counts only what's still owed (amount − paidAmount) on
// unpaid rows; nextDue* is the earliest unpaid instalment by index.
function reduceRows(
  rows: Array<Pick<typeof dealPaymentSchedules.$inferSelect, 'index' | 'dueDate' | 'amount' | 'paidAmount' | 'paid'>>,
): DealProgress {
  let paidAmount = 0;
  let remainingAmount = 0;
  let next: { index: number; dueDate: string; amount: number } | null = null;

  for (const r of rows) {
    paidAmount += r.paidAmount;
    if (!r.paid) {
      remainingAmount += r.amount - r.paidAmount;
      if (!next || r.index < next.index) {
        next = { index: r.index, dueDate: r.dueDate, amount: r.amount };
      }
    }
  }

  return {
    paidAmount,
    remainingAmount,
    nextDueDate: next?.dueDate ?? null,
    nextDueAmount: next?.amount ?? null,
  };
}

// One grouped fetch for many deals — returns a Map keyed by dealId. Deals with
// no schedule rows are absent from the map; callers fall back to ZERO.
export async function loadProgressForDeals(dealIds: string[]): Promise<Map<string, DealProgress>> {
  const out = new Map<string, DealProgress>();
  if (dealIds.length === 0) return out;

  const rows = await db
    .select({
      dealId: dealPaymentSchedules.dealId,
      index: dealPaymentSchedules.index,
      dueDate: dealPaymentSchedules.dueDate,
      amount: dealPaymentSchedules.amount,
      paidAmount: dealPaymentSchedules.paidAmount,
      paid: dealPaymentSchedules.paid,
    })
    .from(dealPaymentSchedules)
    .where(inArray(dealPaymentSchedules.dealId, dealIds))
    .orderBy(dealPaymentSchedules.index);

  const byDeal = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = byDeal.get(r.dealId) ?? [];
    list.push(r);
    byDeal.set(r.dealId, list);
  }

  for (const id of dealIds) {
    out.set(id, byDeal.has(id) ? reduceRows(byDeal.get(id)!) : ZERO);
  }
  return out;
}

// The full instalment list plus the reduced progress totals for a single deal.
export async function loadDealSchedule(dealId: string) {
  const rows = await db
    .select()
    .from(dealPaymentSchedules)
    .where(eq(dealPaymentSchedules.dealId, dealId))
    .orderBy(dealPaymentSchedules.index);

  return {
    progress: reduceRows(rows),
    schedule: rows.map((s) => ({
      index: s.index,
      dueDate: s.dueDate,
      amount: s.amount,
      paidAmount: s.paidAmount,
      paid: s.paid,
      paidAt: s.paidAt?.toISOString() ?? null,
    })),
  };
}
