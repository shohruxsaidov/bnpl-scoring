import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '@db';
import { dealPayments, deals, merchants } from '@db/schema';

// ---------------------------------------------------------------------------
// Client Payments — the authenticated borrower's money-in history.
//
// Reads deal_payments: one row per PAYMENT EVENT, whatever the rail. This is
// deliberately not deal_payment_schedules — the instalment table answers "what
// do I owe and when", which /client/deals/:id already returns. This surface
// answers "what have I paid", so a row here is an amount that actually left the
// client's hands at a knowable instant. Money is in som.
// ---------------------------------------------------------------------------

/**
 * Ownership is the ONLY filter. Deliberately no deal-status restriction, unlike
 * /client/deals: a payment is a financial record, and a real money-in event
 * silently missing from the history is a worse failure than an unexpected row.
 * If a payment ever exists against an odd-status deal, the client should be able
 * to see it rather than have the API conceal it.
 */
function ownedBy(userId: number) {
  return eq(deals.userId, userId);
}

export interface ListClientPaymentsInput {
  userId: number;
  /** 1-based. The offset is derived here so no caller can compute it differently. */
  page: number;
  limit: number;
  /** Inclusive lower bound on createdAt. */
  from?: Date;
  /** Inclusive upper bound on createdAt. */
  to?: Date;
}

export async function listClientPayments(input: ListClientPaymentsInput) {
  // The caller sends full instants, so the window needs no timezone reasoning
  // here — the mobile app resolves the device's offset when it builds them.
  const where = and(
    ownedBy(input.userId),
    input.from ? gte(dealPayments.createdAt, input.from) : undefined,
    input.to ? lte(dealPayments.createdAt, input.to) : undefined,
  );

  const rows = await db
    .select({
      id: dealPayments.id,
      dealId: dealPayments.dealId,
      dealNumber: deals.dealNumber,
      merchantName: merchants.name,
      amount: dealPayments.amount,
      source: dealPayments.source,
      createdAt: dealPayments.createdAt,
    })
    .from(dealPayments)
    // Inner: the join is what scopes the query to the caller, so a payment whose
    // deal is missing must drop out rather than leak.
    .innerJoin(deals, eq(dealPayments.dealId, deals.id))
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .where(where)
    // id breaks ties: two payments can share a createdAt, and without a
    // deterministic order a client paging through sees duplicates and skips rows.
    .orderBy(desc(dealPayments.createdAt), desc(dealPayments.id))
    .limit(input.limit)
    // A page past the end yields an offset past the end, which Postgres answers
    // with zero rows. That empty page is the intended response — see the route.
    .offset((input.page - 1) * input.limit);

  // Counts what the window matched, not the whole history — otherwise a filtered
  // month showing 3 payments would report pagination for the entire credit.
  const [totals] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(dealPayments)
    .innerJoin(deals, eq(dealPayments.dealId, deals.id))
    .where(where);

  const total = totals?.total ?? 0;

  return {
    rows,
    total,
    // Floored at 1: a client with no payments is on "page 1 of 1", not the
    // broken-looking "page 1 of 0".
    lastPage: Math.max(1, Math.ceil(total / input.limit)),
  };
}
