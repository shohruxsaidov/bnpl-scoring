import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { products } from "../../../id/db/schema"

export async function updateProduct(
  db: Db,
  id: number,
  input: Partial<{
    categoryId: number
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
    .where(eq(products.id, id))
    .returning()
  return row
}
