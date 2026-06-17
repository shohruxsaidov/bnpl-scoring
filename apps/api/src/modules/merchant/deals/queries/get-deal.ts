import { and, eq } from 'drizzle-orm';
import type { Db } from '../../../../db';
import { deals, dealItems, dealPaymentSchedules } from '../../../deals/db/schema';
import { clients, tariffs, merchantUsers, merchants, branches } from '@db/schema';

function serializeNumber(v: number | null | undefined): string | null {
  return v == null ? null : v.toString();
}

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? `CN-${String(n).padStart(7, '0')}` : '—';
}

export async function getDealById(db: Db, id: string, merchantId: number) {
  const rows = await db
    .select({
      deal: deals,
      client: clients,
      tariff: tariffs,
      agent: merchantUsers,
      branch: branches,
      merchant: merchants,
    })
    .from(deals)
    .leftJoin(clients, eq(deals.clientId, clients.id))
    .leftJoin(tariffs, eq(deals.tariffId, tariffs.id))
    .leftJoin(merchantUsers, eq(deals.agentId, merchantUsers.id))
    .leftJoin(branches, eq(deals.branchId, branches.id))
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .where(and(eq(deals.id, id), eq(deals.merchantId, merchantId)))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  const { deal: d, client: c, tariff: t, agent, branch, merchant } = row;

  const [items, schedule] = await Promise.all([
    db.select().from(dealItems).where(eq(dealItems.dealId, id)).orderBy(dealItems.id),
    db
      .select()
      .from(dealPaymentSchedules)
      .where(eq(dealPaymentSchedules.dealId, id))
      .orderBy(dealPaymentSchedules.index),
  ]);

  return {
    id: d.id,
    dealNumber: formatDealNumber(d.dealNumber),
    status: d.status,
    createdAt: d.createdAt.toISOString(),
    paymentDay: d.paymentDay,
    merchantName: merchant?.name,
    amount: d.amount != null ? Number(d.amount) : 0,
    totalPayable: d.totalPayable != null ? Number(d.totalPayable) : 0,
    prepaymentAmount: d.prepaymentAmount != null ? Number(d.prepaymentAmount) : 0,
    termMonths: d.termMonths ?? t?.termMonths ?? 0,
    lang: (d.lang ?? 'ru') as 'ru' | 'uz',
    agentId: serializeNumber(d.agentId),
    agentName: agent?.fullName ?? '',
    clientId: serializeNumber(d.clientId),
    clientName: c ? `${c.firstName} ${c.lastName}` : null,
    clientPinfl: c?.pinfl ?? null,
    clientPhone: c?.phone ?? null,
    clientPassportSerial: c?.passportSerial ?? null,
    clientPassportNumber: c?.passportNumber ?? null,
    tariffId: serializeNumber(d.tariffId),
    tariffName: t?.name ?? null,
    scoreSum: d.scoreSum != null ? Number(d.scoreSum) : null,
    scoringDecision: d.scoringDecision ?? null,
    branchName: branch?.name ?? null,
    merchantInn: merchant?.inn ?? null,
    basket: items.map((item) => ({
      productId: serializeNumber(item.productId),
      productName: item.productName,
      price: item.price,
      mxikCode: item.mxikCode,
      packageCode: item.packageCode,
      packageName: item.packageName,
      quantity: item.quantity,
    })),
    schedule: schedule.map((s) => ({
      index: s.index,
      dueDate: s.dueDate,
      amount: Number(s.amount),
      paid: s.paid,
      paidAt: s.paidAt?.toISOString() ?? null,
    })),
  };
}
