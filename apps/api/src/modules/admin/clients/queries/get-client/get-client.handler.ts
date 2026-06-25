import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@db';
import { users, merchants, branches, tariffs } from '@db/schema';
import { deals } from '../../../../deals/schema';

export async function getUserOverview(id: number) {
  const userRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const user = userRows[0];
  if (!user) return null;

  const pinfl = user.pinfl;

  const allUserRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.pinfl, pinfl));
  const allUserIds = allUserRows.map((r) => r.id);

  // TODO: scoring rebuild — credit limit source removed with scoring_histories.
  // Returns null until the new scoring persistence lands.
  const creditLimit: number | null = null;
  const creditLimitScoredAt: string | null = null;

  let committedAmount = 0;
  if (allUserIds.length > 0) {
    const activeDeals = await db
      .select({ amount: deals.amount })
      .from(deals)
      .where(
        and(
          inArray(deals.userId, allUserIds),
          inArray(deals.status, ['active', 'overdue', 'scoring', 'approved']),
        ),
      );
    committedAmount = activeDeals.reduce((sum, d) => sum + (d.amount ? Number(d.amount) : 0), 0);
  }

  const availableBalance = creditLimit != null ? Math.max(0, creditLimit - committedAmount) : null;

  return {
    id: user.id.toString(),
    pinfl: user.pinfl,
    phone: user.phone,
    fullName: `${user.firstName} ${user.lastName}`,
    middleName: user.middleName ?? null,
    birthDate: user.birthDate,
    createdAt: user.createdAt.toISOString(),
    creditLimit,
    availableBalance,
    creditLimitScoredAt,
  };
}
