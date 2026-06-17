import { eq } from "drizzle-orm"
import { db } from '@db'
import { products } from '@db/schema'
import type { UpdateProductCommand } from './update-product.command'

export async function updateProduct({ id, ...input }: UpdateProductCommand) {
  const [row] = await db
    .update(products)
    .set(input)
    .where(eq(products.id, id))
    .returning()
  return row
}
