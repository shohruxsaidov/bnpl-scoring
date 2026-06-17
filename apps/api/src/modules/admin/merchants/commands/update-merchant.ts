import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { merchants } from '@db/schema'

export async function updateMerchant(
  db: Db,
  id: number,
  input: Partial<{
    name: string
    legalName: string
    inn: string
    phone: string
    address: string
    logoUrl: string
    contractNumber: string
    active: boolean
    mfo: string
    accountNumber: string
    bankName: string
    scoringModelId: number | null
  }>,
) {
  const [row] = await db.update(merchants).set(input).where(eq(merchants.id, id)).returning()
  return row
}
