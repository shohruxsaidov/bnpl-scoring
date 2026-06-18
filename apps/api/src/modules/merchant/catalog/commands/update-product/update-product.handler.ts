import { and, eq } from 'drizzle-orm';
import { db } from '@db';
import { products } from '@db/schema';

export async function updateProduct(
  id: number,
  merchantId: number,
  input: Partial<{
    categoryId: number;
    name: string;
    price: string;
    mxikCode: string;
    packageCode: number;
    packageName: string;
    active: boolean;
  }>,
) {
  const [row] = await db
    .update(products)
    .set(input)
    .where(and(eq(products.id, id), eq(products.merchantId, merchantId)))
    .returning();
  return row;
}
