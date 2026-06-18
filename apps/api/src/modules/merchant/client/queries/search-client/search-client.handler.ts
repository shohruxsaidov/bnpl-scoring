import { and, eq, ilike, or } from 'drizzle-orm';
import { db } from '@db';
import { users } from '@db/schema';

export async function searchUsers(q: string, limit = 20) {
  const term = `%${q}%`;
  return db
    .select()
    .from(users)
    .where(
      or(
        ilike(users.firstName, term),
        ilike(users.lastName, term),
        ilike(users.pinfl, term),
        ilike(users.phone, term),
      ),
    )
    .limit(limit);
}

export async function findUserByPinfl(pinfl: string) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.pinfl, pinfl))
    .limit(1);
  return row;
}

export async function findClientByPinflAndMerchant(pinfl: string, _merchantId: number) {
  const [row] = await db
    .select()
    .from(users)
    .where(eq(users.pinfl, pinfl))
    .limit(1);
  return row;
}
