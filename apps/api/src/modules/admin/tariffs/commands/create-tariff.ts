import type { Db } from "../../../../db"
import { tariffs } from '@db/schema'

export async function createTariff(
  db: Db,
  input: {
    name: string
    termMonths: number
    markupPercent: string
    minAmount?: number | null
    maxAmount?: number | null
  },
) {
  const [row] = await db.insert(tariffs).values(input).returning()
  return row!
}
