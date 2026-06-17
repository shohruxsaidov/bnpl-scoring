import { and, eq } from 'drizzle-orm';
import { db } from '@db';
import { merchantCategories } from '@db/schema';

export async function disableMerchantCategory(categoryId: number, merchantId: number) {
  await db
    .delete(merchantCategories)
    .where(
      and(
        eq(merchantCategories.categoryId, categoryId),
        eq(merchantCategories.merchantId, merchantId),
      ),
    );
}
