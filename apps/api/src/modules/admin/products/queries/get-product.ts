import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { products } from "../../../id/db/schema"

export async function getProduct(db: Db, id: number) {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1)
  return row
}
