import { and, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { categories } from "../../../id/db/schema"

export async function listCategories(db: Db, merchantId: bigint) {
  return db
    .select()
    .from(categories)
    .where(and(eq(categories.merchantId, merchantId), eq(categories.active, true)))
    .orderBy(categories.name)
}
