import { eq } from "drizzle-orm"
import { db } from '@db'
import { merchants } from '@db/schema'

export async function getMerchant(id: number) {
  const [row] = await db.select().from(merchants).where(eq(merchants.id, id)).limit(1)
  return row
}
