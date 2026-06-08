import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { tariffs } from "../../../id/db/schema"

export async function updateTariff(
  db: Db,
  id: bigint,
  input: Partial<{ name: string; termMonths: number; markupPercent: string; active: boolean }>,
) {
  const [row] = await db.update(tariffs).set(input).where(eq(tariffs.id, id)).returning()
  return row
}
