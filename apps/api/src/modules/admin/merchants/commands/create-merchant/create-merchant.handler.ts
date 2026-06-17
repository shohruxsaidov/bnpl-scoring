import { db } from '@db'
import { merchants } from '@db/schema'
import type { CreateMerchantCommand } from "./create-merchant.command"

export async function createMerchant(input: CreateMerchantCommand) {
  const [row] = await db.insert(merchants).values(input).returning()
  return row!
}
