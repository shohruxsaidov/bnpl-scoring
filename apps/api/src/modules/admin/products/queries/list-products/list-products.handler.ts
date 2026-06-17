import { and, eq } from "drizzle-orm"
import { db } from '@db'
import { products } from '@db/schema'

export async function listProducts(merchantId: number) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, merchantId), eq(products.active, true)))
    .orderBy(products.name)
}
