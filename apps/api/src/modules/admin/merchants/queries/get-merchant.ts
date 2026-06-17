import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { merchants } from '@db/schema'

export async function getMerchant(db: Db, id: number) {
  const [row] = await db.select().from(merchants).where(eq(merchants.id, id)).limit(1)
  return row
}
