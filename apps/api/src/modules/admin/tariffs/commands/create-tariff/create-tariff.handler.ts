import { db } from '@db'
import { tariffs } from '@db/schema'
import type { CreateTariffInput } from "./create-tariff.command"

export async function createTariff(input: CreateTariffInput) {
  const [row] = await db.insert(tariffs).values({
    ...input,
    minAmount: input.minAmount != null ? String(input.minAmount) : undefined,
    maxAmount: input.maxAmount != null ? String(input.maxAmount) : undefined,
  }).returning()
  return row!
}
