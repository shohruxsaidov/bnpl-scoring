import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { tariffs } from '@db/schema'

export async function updateTariff(
  db: Db,
  id: number,
  input: Partial<{
    name: string
    termMonths: number
    markupPercent: string
    minAmount: number | null
    maxAmount: number | null
    active: boolean
  }>,
) {
  const [row] = await db.update(tariffs).set(input).where(eq(tariffs.id, id)).returning()
  return row
}
