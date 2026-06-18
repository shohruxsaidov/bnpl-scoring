import { eq } from 'drizzle-orm';
import { db } from '@db';
import { branches } from '@db/schema';

export async function listBranches(merchantId: number) {
  return db
    .select()
    .from(branches)
    .where(eq(branches.merchantId, merchantId))
    .orderBy(branches.createdAt);
}
