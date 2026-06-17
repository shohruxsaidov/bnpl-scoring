import { eq } from "drizzle-orm"
import { db } from '@db'
import { merchants } from '@db/schema'
import type { UpdateMerchantCommand } from "./update-merchant.command"

export async function updateMerchant(input: UpdateMerchantCommand) {
  const [row] = await db.update(merchants).set(input.patch).where(eq(merchants.id, input.id)).returning()
  return row
}
