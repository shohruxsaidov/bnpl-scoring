import { and, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { products } from "../../../id/db/schema"

export async function updateProduct(
  db: Db,
  id: bigint,
  merchantId: bigint,
  input: Partial<{
    categoryId: bigint
    name: string
    price: string
    mxikCode: string
    packageCode: number
    packageName: string
    active: boolean
  }>,
) {
  const [row] = await db
    .update(products)
    .set(input)
    .where(and(eq(products.id, id), eq(products.merchantId, merchantId)))
    .returning()
  return row
}
