import type { Db } from "../../../../db"
import { products } from "../../../id/db/schema"

export async function createProduct(
  db: Db,
  input: {
    merchantId: bigint
    categoryId: bigint
    name: string
    price: string
    mxikCode?: string
    packageCode?: number
    packageName?: string
  },
) {
  const [row] = await db.insert(products).values(input).returning()
  return row!
}
