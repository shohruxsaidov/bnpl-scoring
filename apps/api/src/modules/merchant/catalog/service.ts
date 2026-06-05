import { eq, and } from "drizzle-orm"
import type { Db } from "../../../db"
import { products, categories } from "../../id/db/schema"

export async function listCategories(db: Db, merchantId: bigint) {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.merchantId, merchantId), eq(categories.active, true)))
    .orderBy(categories.name)
}

export async function createCategory(db: Db, input: { merchantId: bigint; name: string }) {
  const [row] = await db.insert(categories).values(input).returning()
  return row!
}

export async function updateCategory(db: Db, id: bigint, merchantId: bigint, input: Partial<{ name: string; active: boolean }>) {
  const [row] = await db
    .update(categories)
    .set(input)
    .where(and(eq(categories.id, id), eq(categories.merchantId, merchantId)))
    .returning()
  return row
}

export async function listProducts(db: Db, merchantId: bigint) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, merchantId), eq(products.active, true)))
    .orderBy(products.name)
}

export async function createProduct(
  db: Db,
  input: { merchantId: bigint; categoryId: bigint; name: string; price: string; mxikCode?: string; packageCode?: number; packageName?: string },
) {
  const [row] = await db.insert(products).values(input).returning()
  return row!
}

export async function updateProduct(
  db: Db,
  id: bigint,
  merchantId: bigint,
  input: Partial<{ categoryId: bigint; name: string; price: string; mxikCode: string; packageCode: number; packageName: string; active: boolean }>,
) {
  const [row] = await db
    .update(products)
    .set(input)
    .where(and(eq(products.id, id), eq(products.merchantId, merchantId)))
    .returning()
  return row
}
