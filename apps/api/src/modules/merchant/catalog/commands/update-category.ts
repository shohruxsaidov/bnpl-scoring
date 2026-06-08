import { and, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { categories } from "../../../id/db/schema"

export async function updateCategory(db: Db, id: bigint, merchantId: bigint, input: Partial<{ name: string; active: boolean }>) {
  const [row] = await db
    .update(categories)
    .set(input)
    .where(and(eq(categories.id, id), eq(categories.merchantId, merchantId)))
    .returning()
  return row
}
