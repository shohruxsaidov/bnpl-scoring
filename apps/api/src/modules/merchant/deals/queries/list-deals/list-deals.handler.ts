import { and, asc, desc, eq } from 'drizzle-orm';
import { db } from '@db';
import { deals } from '../../../../deals/schema';
import { users, tariffs, merchantUsers } from '@db/schema';

function serializeNumber(v: number | null | undefined): string | null {
  return v == null ? null : v.toString();
}

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? String(n) : '—';
}

function toDealDto(
  d: typeof deals.$inferSelect,
  c: typeof users.$inferSelect | null,
  t: typeof tariffs.$inferSelect | null,
  agentName: string,
) {
  return {
    id: d.id,
    dealNumber: formatDealNumber(d.dealNumber),
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    paymentDay: d.paymentDay,
    amount: d.amount != null ? Number(d.amount) : 0,
    totalPayable: d.totalPayable != null ? Number(d.totalPayable) : 0,
    termMonths: d.termMonths ?? t?.termMonths ?? 0,
    lang: (d.lang ?? 'ru') as 'ru' | 'uz',
    agentId: serializeNumber(d.agentId),
    agentName,
    userId: serializeNumber(d.userId),
    clientName: c ? `${c.firstName} ${c.lastName}` : null,
    clientPinfl: c?.pinfl ?? null,
    clientPhone: c?.phone ?? null,
    clientPassportSeries: c?.passportSeries ?? null,
    clientPassportNumber: c?.passportNumber ?? null,
    tariffId: serializeNumber(d.tariffId),
    tariffName: t?.name ?? null,
    scoreSum: d.scoreSum != null ? Number(d.scoreSum) : null,
    scoringDecision: d.scoringDecision ?? null,
  };
}

export async function listDeals(
  merchantId: number,
  agentId?: number,
  sort?: { sortBy?: string; sortOrder?: string },
) {
  const filter = agentId
    ? and(eq(deals.merchantId, merchantId), eq(deals.agentId, agentId))
    : eq(deals.merchantId, merchantId);

  const dir = sort?.sortOrder === 'asc' ? asc : desc;
  const orderCol =
    sort?.sortBy === 'status'
      ? deals.status
      : sort?.sortBy === 'amount'
        ? deals.totalPayable
        : deals.createdAt;

  const rows = await db
    .select({ deal: deals, client: users, tariff: tariffs, agent: merchantUsers })
    .from(deals)
    .leftJoin(users, eq(deals.userId, users.id))
    .leftJoin(tariffs, eq(deals.tariffId, tariffs.id))
    .leftJoin(merchantUsers, eq(deals.agentId, merchantUsers.id))
    .where(filter)
    .orderBy(dir(orderCol));

  return rows
    .filter((r) => r.deal.status !== 'draft')
    .map((r) => toDealDto(r.deal, r.client, r.tariff, r.agent?.fullName ?? ''));
}
