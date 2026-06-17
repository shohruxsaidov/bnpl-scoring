import { and, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { products } from '@db/schema'

export async function listProducts(db: Db, merchantId: number) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, merchantId), eq(products.active, true)))
    .orderBy(products.name)
}
