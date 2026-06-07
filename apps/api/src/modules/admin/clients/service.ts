import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db } from "../../../db/index.js";
import { clients, users, merchants, branches, tariffs } from "../../id/db/schema.js";
import { deals, dealPaymentSchedules, scoringHistories } from "../../deals/db/schema.js";
import { userLimits } from "../../scoring/db/schema.js";

export async function listUniqueClients(db: Db) {
  // One row per unique PINFL — pick the earliest record (first time this person
  // appeared in the platform). Personal data is identical across merchants since
  // it originates from MyID.
  return db.execute<{
    id: string;
    pinfl: string;
    phone: string;
    first_name: string;
    last_name: string;
    middle_name: string | null;
    birth_date: string;
    created_at: string;
  }>(sql`
    SELECT DISTINCT ON (${clients.pinfl})
      ${clients.id}::text        AS id,
      ${clients.pinfl}           AS pinfl,
      ${clients.phone}           AS phone,
      ${clients.firstName}       AS first_name,
      ${clients.lastName}        AS last_name,
      ${clients.middleName}      AS middle_name,
      ${clients.birthDate}       AS birth_date,
      ${clients.createdAt}       AS created_at
    FROM ${clients}
    ORDER BY ${clients.pinfl}, ${clients.createdAt} ASC
  `);
}

function formatDealNumber(n: bigint | null | undefined): string {
  return n != null ? `CN-${String(n).padStart(7, "0")}` : "—";
}

// ---------------------------------------------------------------------------
// Client overview — personal info + credit limit
// ---------------------------------------------------------------------------

export async function getClientOverview(db: Db, id: bigint) {
  const clientRows = await db
    .select()
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  const client = clientRows[0];
  if (!client) return null;

  const pinfl = client.pinfl;

  // All client IDs for this PINFL across merchants
  const allClientRows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.pinfl, pinfl));
  const allClientIds = allClientRows.map((r) => r.id);

  // Credit limit: user_limits first (self-service), fallback to scoring_histories (wizard)
  let creditLimit: number | null = null;
  let creditLimitSource: "self-service" | "wizard" | null = null;
  let creditLimitScoredAt: string | null = null;

  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.pinfl, pinfl))
    .limit(1);

  if (userRows[0]) {
    const limitRows = await db
      .select()
      .from(userLimits)
      .where(eq(userLimits.userId, userRows[0].id))
      .limit(1);

    if (limitRows[0]) {
      creditLimit = Number(limitRows[0].limitAmount);
      creditLimitSource = "self-service";
      creditLimitScoredAt = limitRows[0].scoredAt.toISOString();
    }
  }

  if (creditLimit === null) {
    const scoringRows = await db
      .select({
        platformCreditLimit: scoringHistories.platformCreditLimit,
        scoredAt: scoringHistories.scoredAt,
      })
      .from(scoringHistories)
      .where(eq(scoringHistories.pinfl, pinfl))
      .orderBy(desc(scoringHistories.scoredAt))
      .limit(1);

    if (scoringRows[0]) {
      creditLimit = Number(scoringRows[0].platformCreditLimit);
      creditLimitSource = "wizard";
      creditLimitScoredAt = scoringRows[0].scoredAt.toISOString();
    }
  }

  // Available balance = creditLimit - sum of amount for active/overdue deals
  let committedAmount = 0;
  if (allClientIds.length > 0) {
    const activeDeals = await db
      .select({ amount: deals.amount })
      .from(deals)
      .where(
        and(
          inArray(deals.clientId, allClientIds),
          inArray(deals.status, ["active", "overdue", "scoring", "approved"]),
        ),
      );
    committedAmount = activeDeals.reduce(
      (sum, d) => sum + (d.amount ? Number(d.amount) : 0),
      0,
    );
  }

  const availableBalance =
    creditLimit != null ? Math.max(0, creditLimit - committedAmount) : null;

  return {
    id: client.id.toString(),
    pinfl: client.pinfl,
    phone: client.phone,
    fullName: `${client.firstName} ${client.lastName}`,
    middleName: client.middleName ?? null,
    birthDate: client.birthDate,
    createdAt: client.createdAt.toISOString(),
    creditLimit,
    availableBalance,
    creditLimitSource,
    creditLimitScoredAt,
  };
}

// ---------------------------------------------------------------------------
// Client deals — all non-draft deals across all merchants for this PINFL
// ---------------------------------------------------------------------------

export async function listClientDeals(db: Db, id: bigint) {
  const clientRows = await db
    .select({ pinfl: clients.pinfl })
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!clientRows[0]) return [];
  const pinfl = clientRows[0].pinfl;

  const allClientRows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.pinfl, pinfl));
  const allClientIds = allClientRows.map((r) => r.id);

  if (allClientIds.length === 0) return [];

  const rows = await db
    .select({
      deal: deals,
      merchant: merchants,
      branch: branches,
      tariff: tariffs,
    })
    .from(deals)
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .leftJoin(branches, eq(deals.branchId, branches.id))
    .leftJoin(tariffs, eq(deals.tariffId, tariffs.id))
    .where(
      and(
        inArray(deals.clientId, allClientIds),
        sql`${deals.status} != 'draft'`,
      ),
    )
    .orderBy(desc(deals.createdAt));

  return rows.map(({ deal, merchant, branch, tariff }) => ({
    id: deal.id,
    dealNumber: formatDealNumber(deal.dealNumber),
    merchantName: merchant?.name ?? "—",
    branchName: branch?.name ?? "—",
    status: deal.status,
    amount: deal.amount != null ? Number(deal.amount) : 0,
    totalPayable: deal.totalPayable != null ? Number(deal.totalPayable) : 0,
    tariffName: tariff?.name ?? "—",
    termMonths: deal.termMonths ?? tariff?.termMonths ?? 0,
    createdAt: deal.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Client scoring history — wizard + self-service merged, queried by PINFL
// ---------------------------------------------------------------------------

export async function listClientScoring(db: Db, id: bigint) {
  const clientRows = await db
    .select({ pinfl: clients.pinfl })
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!clientRows[0]) return [];
  const pinfl = clientRows[0].pinfl;

  const rows = await db
    .select()
    .from(scoringHistories)
    .where(eq(scoringHistories.pinfl, pinfl))
    .orderBy(desc(scoringHistories.scoredAt));

  return rows.map((r) => ({
    id: r.id.toString(),
    source: r.clientId != null ? ("wizard" as const) : ("self-service" as const),
    decision: r.decision,
    score: r.scoreSum != null ? Number(r.scoreSum) : 0,
    limit: Number(r.platformCreditLimit),
    scoredAt: r.scoredAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Client payments — all InstallmentScheduleRows across all deals for this PINFL
// ---------------------------------------------------------------------------

export async function listClientPayments(db: Db, id: bigint) {
  const clientRows = await db
    .select({ pinfl: clients.pinfl })
    .from(clients)
    .where(eq(clients.id, id))
    .limit(1);

  if (!clientRows[0]) return [];
  const pinfl = clientRows[0].pinfl;

  const allClientRows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.pinfl, pinfl));
  const allClientIds = allClientRows.map((r) => r.id);

  if (allClientIds.length === 0) return [];

  // Get all non-draft deals for these client IDs
  const dealRows = await db
    .select({
      deal: { id: deals.id, dealNumber: deals.dealNumber, merchantId: deals.merchantId },
      merchant: { name: merchants.name },
    })
    .from(deals)
    .leftJoin(merchants, eq(deals.merchantId, merchants.id))
    .where(
      and(
        inArray(deals.clientId, allClientIds),
        sql`${deals.status} != 'draft'`,
      ),
    );

  if (dealRows.length === 0) return [];

  const dealIds = dealRows.map((r) => r.deal.id);
  const dealIndex = new Map(
    dealRows.map((r) => [
      r.deal.id,
      {
        dealNumber: formatDealNumber(r.deal.dealNumber),
        merchantName: r.merchant?.name ?? "—",
      },
    ]),
  );

  const scheduleRows = await db
    .select()
    .from(dealPaymentSchedules)
    .where(inArray(dealPaymentSchedules.dealId, dealIds))
    .orderBy(desc(dealPaymentSchedules.dueDate));

  return scheduleRows.map((s) => {
    const dealInfo = dealIndex.get(s.dealId);
    const paidAmount = Number(s.paidAmount ?? 0n);
    const amount = Number(s.amount);
    const status = s.paid ? "paid" : paidAmount > 0 ? "partial" : "unpaid";
    return {
      id: s.id.toString(),
      dealId: s.dealId,
      dealNumber: dealInfo?.dealNumber ?? "—",
      merchantName: dealInfo?.merchantName ?? "—",
      dueDate: s.dueDate,
      amount,
      paidAmount,
      status,
      channel: s.manualPaymentId != null ? ("manual" as const) : ("automated" as const),
    };
  });
}
