import { and, asc, eq, ilike, sql } from 'drizzle-orm';
import { db } from '@db';
import { branches, merchants } from '@db/schema';

// Active branches for a merchant, as a scalar. Used both to report branchCount
// and to express "has somewhere you can actually walk into" — keeping it one
// expression means the count a client sees can never disagree with the rule that
// let the merchant into the catalog.
const activeBranchCount = sql<number>`(
  select count(*)::int from ${branches}
  where ${branches.merchantId} = ${merchants.id}
    and ${branches.active} = true
)`;

// THE visibility predicate for the client catalog. Both the list and the detail
// endpoint must use this: filtering only the list would leave every hidden
// merchant fully readable by id, which makes visibleInClientApp worthless.
//
// Deliberately not gated on kybStatus — that is a compliance state about
// onboarding paperwork, not a merchandising decision.
function visibleMerchant() {
  return and(
    eq(merchants.active, true),
    eq(merchants.visibleInClientApp, true),
    sql`${activeBranchCount} > 0`,
  );
}

// `q` goes into an ILIKE pattern, where % and _ are wildcards. Without escaping,
// a user typing "%" matches the whole catalog.
function escapeLikePattern(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function searchClause(q: string | undefined) {
  const trimmed = q?.trim();
  if (!trimmed) return undefined;
  return ilike(merchants.name, `%${escapeLikePattern(trimmed)}%`);
}

export async function listVisibleMerchants(input: {
  limit: number;
  offset: number;
  q?: string;
}) {
  const where = and(visibleMerchant(), searchClause(input.q));

  const rows = await db
    .select({
      id: merchants.id,
      name: merchants.name,
      logoFileId: merchants.logoFileId,
      branchCount: activeBranchCount,
    })
    .from(merchants)
    .where(where)
    // id breaks ties: merchants.name has no unique constraint, and without a
    // deterministic order a client paging with limit/offset sees duplicates and
    // skips rows.
    .orderBy(asc(merchants.name), asc(merchants.id))
    .limit(input.limit)
    .offset(input.offset);

  // Counts what the filter matched, not the catalog size — otherwise a search
  // showing 3 results would report pagination for hundreds.
  const [totals] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(merchants)
    .where(where);

  return { rows, total: totals?.total ?? 0 };
}

export async function getVisibleMerchant(id: number) {
  const [row] = await db
    .select({
      id: merchants.id,
      name: merchants.name,
      logoFileId: merchants.logoFileId,
    })
    .from(merchants)
    .where(and(eq(merchants.id, id), visibleMerchant()))
    .limit(1);
  return row;
}

export async function listActiveBranches(merchantId: number) {
  return db
    .select({
      id: branches.id,
      name: branches.name,
      address: branches.address,
      phone: branches.phone,
      latitude: branches.latitude,
      longitude: branches.longitude,
    })
    .from(branches)
    .where(and(eq(branches.merchantId, merchantId), eq(branches.active, true)))
    .orderBy(asc(branches.name), asc(branches.id));
}
