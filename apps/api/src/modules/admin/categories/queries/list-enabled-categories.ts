import { and, eq } from 'drizzle-orm';
import type { Db } from '../../../../db';
import { categories, merchantCategories } from '../../../id/db/schema';

export async function listEnabledCategories(db: Db, merchantId: number) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      active: categories.active,
      createdAt: categories.createdAt,
    })
    .from(categories)
    .innerJoin(
      merchantCategories,
      and(
        eq(merchantCategories.categoryId, categories.id),
        eq(merchantCategories.merchantId, merchantId),
      ),
    )
    .where(eq(categories.active, true))
    .orderBy(categories.name);
}
