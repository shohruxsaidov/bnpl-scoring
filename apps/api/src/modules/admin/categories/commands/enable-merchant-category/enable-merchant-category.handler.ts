import { db } from '@db';
import { merchantCategories } from '@db/schema';

export async function enableMerchantCategory(categoryId: number, merchantId: number) {
  await db.insert(merchantCategories).values({ categoryId, merchantId }).onConflictDoNothing();
}
