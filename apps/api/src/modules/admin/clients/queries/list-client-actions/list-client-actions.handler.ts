import { desc, eq } from 'drizzle-orm';
import { db } from '@db';
import { clientActions } from '@db/client-actions';
import { merchantUsers } from '@db/merchant-users';
import { merchants } from '@db/merchants';

// The Действия tab — the client's milestone trail, newest first. Matches the
// other client tabs: a flat 100-row window, no pagination. A client accumulates
// on the order of ten of these in a lifetime, so a cursor would be scaffolding
// for a case that does not arrive.
//
// Ordered by occurred_at, NEVER by id: backfilled rows were inserted long after
// they happened, and ordering by id would scramble them into insertion order.
// The id tiebreaker settles the pair that matters — deal_sign_myid and
// deal_sign_otp routinely land in the same second, and showing the акцепт above
// the face-scan would read as the client consenting before identifying themselves.
export async function listUserActions(userId: number) {
  const rows = await db
    .select({
      id: clientActions.id,
      action: clientActions.action,
      status: clientActions.status,
      reasonCode: clientActions.reasonCode,
      actorType: clientActions.actorType,
      actorName: merchantUsers.fullName,
      merchantName: merchants.name,
      channel: clientActions.channel,
      dealId: clientActions.dealId,
      scoringId: clientActions.scoringId,
      occurredAt: clientActions.occurredAt,
      createdAt: clientActions.createdAt,
    })
    .from(clientActions)
    .leftJoin(merchantUsers, eq(clientActions.actorId, merchantUsers.id))
    .leftJoin(merchants, eq(clientActions.merchantId, merchants.id))
    .where(eq(clientActions.userId, userId))
    .orderBy(desc(clientActions.occurredAt), desc(clientActions.id))
    .limit(100);

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    status: r.status,
    reasonCode: r.reasonCode,
    actorType: r.actorType,
    actorName: r.actorName ?? null,
    merchantName: r.merchantName ?? null,
    channel: r.channel,
    dealId: r.dealId,
    scoringId: r.scoringId,
    occurredAt: r.occurredAt.toISOString(),
    // A row whose occurred_at long predates its insert was reconstructed by the
    // backfill script, not observed. The admin should be able to tell, because
    // backfilled rows carry inferred actors — see the script's header.
    backfilled: r.createdAt.getTime() - r.occurredAt.getTime() > 24 * 60 * 60 * 1000,
  }));
}
