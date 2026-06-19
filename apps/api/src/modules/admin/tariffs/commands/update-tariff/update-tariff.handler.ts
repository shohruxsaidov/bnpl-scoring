import { eq } from "drizzle-orm"
import { db } from '@db'
import { tariffs } from '@db/schema'
import type { UpdateTariffInput } from "./update-tariff.command"

export async function updateTariff({ id, data }: UpdateTariffInput) {
  const { minAmount, maxAmount, ...rest } = data
  const [row] = await db.update(tariffs).set({
    ...rest,
    ...(minAmount !== undefined ? { minAmount: minAmount != null ? String(minAmount) : null } : {}),
    ...(maxAmount !== undefined ? { maxAmount: maxAmount != null ? String(maxAmount) : null } : {}),
  }).where(eq(tariffs.id, id)).returning()
  return row
}
