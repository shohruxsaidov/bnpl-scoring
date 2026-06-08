import { and, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { products } from "../../../id/db/schema"

export async function listProducts(db: Db, merchantId: bigint) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, merchantId), eq(products.active, true)))
    .orderBy(products.name)
}
