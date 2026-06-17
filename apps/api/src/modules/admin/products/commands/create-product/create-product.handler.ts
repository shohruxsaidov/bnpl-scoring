import { db } from '@db'
import { products } from '@db/schema'
import type { CreateProductInput } from "./create-product.command"

export async function createProduct(input: CreateProductInput) {
  const [row] = await db.insert(products).values(input).returning()
  return row!
}
