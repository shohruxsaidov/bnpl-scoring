import { eq } from "drizzle-orm"
import type { Db } from "../../../db"
import { products } from "../../id/db/schema"

export async function listProducts(db: Db, merchantId: bigint) {
  return db.select().from(products).where(eq(products.merchantId, merchantId)).orderBy(products.name)
}

export async function getProduct(db: Db, id: bigint) {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1)
  return row
}

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

export async function updateProduct(
  db: Db,
  id: bigint,
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
  const [row] = await db.update(products).set(input).where(eq(products.id, id)).returning()
  return row
}
