import { eq } from "drizzle-orm"
import { db } from '@db'
import { tariffs } from '@db/schema'
import type { UpdateTariffInput } from "./update-tariff.command"

export async function updateTariff({ id, data }: UpdateTariffInput) {
  const [row] = await db.update(tariffs).set(data).where(eq(tariffs.id, id)).returning()
  return row
}
