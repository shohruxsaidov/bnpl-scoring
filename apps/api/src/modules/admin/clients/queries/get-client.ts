import { and, desc, eq, inArray } from 'drizzle-orm';
import type { Db } from '../../../../db';
import { clients, users, merchants, branches, tariffs } from '@db/schema';
import { deals, scoringHistories } from '../../../deals/db/schema';

export async function getClientOverview(db: Db, id: number) {
  const clientRows = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  const client = clientRows[0];
  if (!client) return null;

  const pinfl = client.pinfl;

  const allClientRows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.pinfl, pinfl));
  const allClientIds = allClientRows.map((r) => r.id);

  let creditLimit: number | null = null;
  let creditLimitScoredAt: string | null = null;

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
    creditLimitScoredAt = scoringRows[0].scoredAt.toISOString();
  }

  let committedAmount = 0;
  if (allClientIds.length > 0) {
    const activeDeals = await db
      .select({ amount: deals.amount })
      .from(deals)
      .where(
        and(
          inArray(deals.clientId, allClientIds),
          inArray(deals.status, ['active', 'overdue', 'scoring', 'approved']),
        ),
      );
    committedAmount = activeDeals.reduce((sum, d) => sum + (d.amount ? Number(d.amount) : 0), 0);
  }

  const availableBalance = creditLimit != null ? Math.max(0, creditLimit - committedAmount) : null;

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
    creditLimitScoredAt,
  };
}
