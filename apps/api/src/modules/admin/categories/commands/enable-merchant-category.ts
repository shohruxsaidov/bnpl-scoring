import type { Db } from '../../../../db';
import { merchantCategories } from '../../../id/db/schema';

export async function enableMerchantCategory(db: Db, categoryId: number, merchantId: number) {
  await db.insert(merchantCategories).values({ categoryId, merchantId }).onConflictDoNothing();
}
