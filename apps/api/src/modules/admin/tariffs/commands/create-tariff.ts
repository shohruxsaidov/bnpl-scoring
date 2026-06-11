import type { Db } from "../../../../db"
import { tariffs } from "../../../id/db/schema"

export async function createTariff(
  db: Db,
  input: {
    name: string
    termMonths: number
    markupPercent: string
    minAmount?: bigint | null
    maxAmount?: bigint | null
  },
) {
  const [row] = await db.insert(tariffs).values(input).returning()
  return row!
}
