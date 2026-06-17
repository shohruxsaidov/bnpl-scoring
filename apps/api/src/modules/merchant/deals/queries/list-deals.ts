import { and, asc, desc, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { deals } from "../../../deals/schema"
import { clients, tariffs, merchantUsers } from '@db/schema'

function serializeNumber(v: number | null | undefined): string | null {
  return v == null ? null : v.toString()
}

function formatDealNumber(n: number | null | undefined): string {
  return n != null ? `CN-${String(n).padStart(7, "0")}` : "—"
}

function toDealDto(
  d: typeof deals.$inferSelect,
  c: typeof clients.$inferSelect | null,
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
    lang: (d.lang ?? "ru") as "ru" | "uz",
    agentId: serializeNumber(d.agentId),
    agentName,
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
  }
}

export async function listDeals(
  db: Db,
  merchantId: number,
  agentId?: number,
  sort?: { sortBy?: string; sortOrder?: string },
) {
  const filter = agentId
    ? and(eq(deals.merchantId, merchantId), eq(deals.agentId, agentId))
    : eq(deals.merchantId, merchantId)

  const dir = sort?.sortOrder === "asc" ? asc : desc
  const orderCol =
    sort?.sortBy === "status" ? deals.status :
    sort?.sortBy === "amount" ? deals.totalPayable :
    deals.createdAt

  const rows = await db
    .select({ deal: deals, client: clients, tariff: tariffs, agent: merchantUsers })
    .from(deals)
    .leftJoin(clients, eq(deals.clientId, clients.id))
    .leftJoin(tariffs, eq(deals.tariffId, tariffs.id))
    .leftJoin(merchantUsers, eq(deals.agentId, merchantUsers.id))
    .where(filter)
    .orderBy(dir(orderCol))

  return rows
    .filter((r) => r.deal.status !== "draft")
    .map((r) => toDealDto(r.deal, r.client, r.tariff, r.agent?.fullName ?? ""))
}
