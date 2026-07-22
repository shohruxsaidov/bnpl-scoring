import { and, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
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
      paymentType: dealPayments.paymentType,
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

// ---------------------------------------------------------------------------
// The same money-in events, projected per credit instead of as one flat feed:
// [{ deal, payments[] }]. Not a variant of the query above — it pages over
// DEALS, so a returned deal always carries its COMPLETE payment history. That
// is the whole point: a group split across two pages would show the same credit
// twice with a different "paid so far" each time.
//
// Deliberately no date window. `paidTotal` is a lifetime figure read against
// `totalPayable`; a filter would make the same field mean two things depending
// on query params, and the flat feed above already owns "what did I pay in July".
// ---------------------------------------------------------------------------

export interface ListClientPaymentsByDealInput {
  userId: number;
  /** 1-based, over deals. */
  page: number;
  limit: number;
}

/**
 * A deal earns a place here by having money against it — nothing else. No
 * status filter (same reasoning as the flat feed: a real payment must never be
 * concealed), and no zero-payment deals, which on a payments screen are noise.
 */
const HAS_PAYMENT = sql`exists (select 1 from ${dealPayments} where ${dealPayments.dealId} = ${deals.id})`;

export async function listClientPaymentsByDeal(input: ListClientPaymentsByDealInput) {
  const where = and(ownedBy(input.userId), HAS_PAYMENT);

  const dealRows = await db
    .select({
      dealId: deals.id,
      dealNumber: deals.dealNumber,
      status: deals.status,
      merchantName: merchants.name,
      totalPayable: deals.totalPayable,
    })
    .from(deals)
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .where(where)
    // dealNumber is a unique monotonic identity, so this is newest-credit-first
    // AND a totally deterministic paging key with no tie-break needed. Ordering
    // by "most recent payment" instead would reshuffle the list on every
    // payment and let a client paging through miss a deal entirely.
    .orderBy(desc(deals.dealNumber))
    .limit(input.limit)
    .offset((input.page - 1) * input.limit);

  // Counted separately rather than with count(*) over (): a page past the end
  // returns no rows, and a window function on zero rows yields no total at all
  // — which would report lastPage 1 for a client who has twelve deals.
  const [totals] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(deals)
    .where(where);

  const total = totals?.total ?? 0;

  // One fetch for the whole page — never per deal.
  const payments = dealRows.length
    ? await db
        .select({
          id: dealPayments.id,
          dealId: dealPayments.dealId,
          amount: dealPayments.amount,
          source: dealPayments.source,
          paymentType: dealPayments.paymentType,
          createdAt: dealPayments.createdAt,
        })
        .from(dealPayments)
        .where(inArray(dealPayments.dealId, dealRows.map((d) => d.dealId)))
        // Same order as the flat feed, so a payment does not appear to move
        // when the user switches between the two screens.
        .orderBy(desc(dealPayments.createdAt), desc(dealPayments.id))
    : [];

  const byDeal = new Map<string, typeof payments>();
  for (const p of payments) {
    const list = byDeal.get(p.dealId) ?? [];
    list.push(p);
    byDeal.set(p.dealId, list);
  }

  const rows = dealRows.map((d) => {
    // Every deal here has payments by construction, but a concurrent delete
    // could empty one between the two queries; [] keeps the shape honest.
    const list = byDeal.get(d.dealId) ?? [];
    return {
      ...d,
      // Summed in JS, not SQL: the group is never truncated, so this is exactly
      // the sum of what the client is looking at — no aggregate can disagree
      // with the list rendered beneath it.
      paidTotal: list.reduce((sum, p) => sum + Number(p.amount), 0),
      payments: list,
    };
  });

  return {
    rows,
    total,
    lastPage: Math.max(1, Math.ceil(total / input.limit)),
  };
}
