import { and, eq } from 'drizzle-orm';
import type { Db } from '../../../../db';
import { merchantCategories } from '@db/schema';

export async function disableMerchantCategory(db: Db, categoryId: number, merchantId: number) {
  await db
    .delete(merchantCategories)
    .where(
      and(
        eq(merchantCategories.categoryId, categoryId),
        eq(merchantCategories.merchantId, merchantId),
      ),
    );
}
