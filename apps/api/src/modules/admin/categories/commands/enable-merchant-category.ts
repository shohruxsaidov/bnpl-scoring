import type { Db } from '../../../../db';
import { merchantCategories } from '@db/schema';

export async function enableMerchantCategory(db: Db, categoryId: number, merchantId: number) {
  await db.insert(merchantCategories).values({ categoryId, merchantId }).onConflictDoNothing();
}
