import { db } from '@db';
import { FindByPhoneQuery } from './find-user.query';
import { users } from '@db/users';
import { ilike, or } from 'drizzle-orm';

export function findUsersHandler({ query }: FindByPhoneQuery) {
  const term = `%${query}%`;
  return db
    .select()
    .from(users)
    .where(or(ilike(users.pinfl, term), ilike(users.pinfl, term)))
    .limit(2);
}
