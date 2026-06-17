import { eq } from "drizzle-orm"
import { db } from '@db'
import { tariffs } from '@db/schema'

export async function getTariff(id: number) {
  const [row] = await db.select().from(tariffs).where(eq(tariffs.id, id)).limit(1)
  return row
}
