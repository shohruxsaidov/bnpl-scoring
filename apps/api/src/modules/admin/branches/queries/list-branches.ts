import { eq } from 'drizzle-orm';
import type { Db } from '../../../../db';
import { branches } from '@db/schema';

export async function listBranches(db: Db, merchantId: number) {
  return db
    .select()
    .from(branches)
    .where(eq(branches.merchantId, merchantId))
    .orderBy(branches.createdAt);
}
