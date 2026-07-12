import { eq } from 'drizzle-orm';
import { db } from '@db';
import { users } from '@db/schema';
import { userCreditLimits } from '@db/user-credit-limits';
import { loadBlockingDeal } from '../../../../deals/blocking';

// A limit is a one-shot ticket: the client either holds an unspent one or they
// do not. There is no "available balance" to report — the deal that spends the
// limit spends all of it, whatever it was worth, and deletes the row on its way
// past (see modules/deals/blocking.ts). What replaces the balance is the deal
// itself: when a client shows no limit, the reason is the deal named here.
export async function getUserOverview(id: number) {
  const userRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  const user = userRows[0];
  if (!user) return null;

  const [[limit], blockingDeal] = await Promise.all([
    db.select().from(userCreditLimits).where(eq(userCreditLimits.userId, id)).limit(1),
    loadBlockingDeal(id),
  ]);

  // Only an unspent limit is a limit: a lapsed one buys nothing, and a zero is
  // the cooldown a rejection left behind, not an offer of nothing.
  const usable =
    limit && limit.expiresAt.getTime() > Date.now() && Number(limit.creditLimit) > 0 ? limit : null;

  return {
    id: user.id.toString(),
    pinfl: user.pinfl,
    phone: user.phone,
    fullName: `${user.firstName} ${user.lastName}`,
    middleName: user.middleName ?? null,
    birthDate: user.birthDate,
    createdAt: user.createdAt.toISOString(),
    creditLimit: usable ? usable.creditLimit : null,
    creditLimitScoredAt: usable ? usable.scoredAt.toISOString() : null,
    creditLimitExpiresAt: usable ? usable.expiresAt.toISOString() : null,
    // The deal holding the client's one slot — null when they are free to score.
    blockingDealNumber: blockingDeal?.dealNumber ?? null,
  };
}
