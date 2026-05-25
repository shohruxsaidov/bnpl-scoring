import { eq } from "drizzle-orm"
import type { Db } from "../../../db"
import { categories } from "../../id/db/schema"

export async function listCategories(db: Db, merchantId: bigint) {
  return db.select().from(categories).where(eq(categories.merchantId, merchantId)).orderBy(categories.name)
}

export async function getCategory(db: Db, id: bigint) {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1)
  return row
}

export async function createCategory(db: Db, input: { merchantId: bigint; name: string }) {
  const [row] = await db.insert(categories).values(input).returning()
  return row!
}

export async function updateCategory(
  db: Db,
  id: bigint,
  input: Partial<{ name: string; active: boolean }>,
) {
  const [row] = await db.update(categories).set(input).where(eq(categories.id, id)).returning()
  return row
}
