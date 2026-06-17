import { and, eq } from 'drizzle-orm';
import type { Db } from '../../../../db';
import { categories, merchantCategories } from '@db/schema';

export async function isCategoryEnabledForMerchant(
  db: Db,
  categoryId: number,
  merchantId: number,
): Promise<boolean> {
  const [row] = await db
    .select({ categoryId: merchantCategories.categoryId })
    .from(merchantCategories)
    .innerJoin(
      categories,
      and(eq(categories.id, merchantCategories.categoryId), eq(categories.active, true)),
    )
    .where(
      and(
        eq(merchantCategories.categoryId, categoryId),
        eq(merchantCategories.merchantId, merchantId),
      ),
    )
    .limit(1);
  return !!row;
}
