import { eq } from 'drizzle-orm';
import { db } from '@db';
import { buyouts, deals, dealItems } from '../../../../deals/schema';
import { merchants, branches, merchantUsers, users } from '@db/schema';
import type { BuyoutDto } from '../../queries/list-buyouts/list-buyouts.handler';

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? `CN-${String(n).padStart(7, '0')}` : '—';
}

export async function markBuyoutPaid(id: number): Promise<BuyoutDto | null> {
  const [updated] = await db
    .update(buyouts)
    .set({ status: 'paid' })
    .where(eq(buyouts.id, id))
    .returning();

  if (!updated) return null;

  const rows = await db
    .select({
      buyout: buyouts,
      deal: { dealNumber: deals.dealNumber },
      merchant: { id: merchants.id, name: merchants.name },
      branch: { name: branches.name },
      agent: { fullName: merchantUsers.fullName },
      client: { firstName: users.firstName, lastName: users.lastName, phone: users.phone },
    })
    .from(buyouts)
    .leftJoin(deals, eq(buyouts.dealId, deals.id))
    .leftJoin(merchants, eq(buyouts.merchantId, merchants.id))
    .leftJoin(branches, eq(buyouts.branchId, branches.id))
    .leftJoin(merchantUsers, eq(deals.agentId, merchantUsers.id))
    .leftJoin(users, eq(deals.userId, users.id))
    .where(eq(buyouts.id, id))
    .limit(1);

  const r = rows[0];
  if (!r) return null;

  const itemRows = await db.select().from(dealItems).where(eq(dealItems.dealId, r.buyout.dealId));

  return {
    id: String(r.buyout.id),
    dealId: r.buyout.dealId,
    dealNumber: formatDealNumber(r.deal?.dealNumber ?? null),
    merchantId: String(r.buyout.merchantId),
    merchantName: r.merchant?.name ?? '—',
    branchName: r.branch?.name ?? '—',
    agentName: r.agent?.fullName ?? '—',
    clientName: r.client ? `${r.client.lastName} ${r.client.firstName}` : '—',
    clientPhone: r.client?.phone ?? '—',
    amount: Number(r.buyout.amount),
    status: r.buyout.status,
    createdAt: r.buyout.createdAt.toISOString(),
    items: itemRows.map((i) => {
      const price = Math.round(parseFloat(i.price) * 100);
      return { productName: i.productName, price, qty: i.quantity, amount: price * i.quantity };
    }),
  };
}
