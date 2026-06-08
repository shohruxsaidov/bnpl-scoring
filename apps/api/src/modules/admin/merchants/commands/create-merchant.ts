import type { Db } from "../../../../db"
import { merchants } from "../../../id/db/schema"

export async function createMerchant(
  db: Db,
  input: {
    name: string
    legalName: string
    inn: string
    phone: string
    address: string
    logoUrl?: string
    contractNumber?: string
  },
) {
  const [row] = await db.insert(merchants).values(input).returning()
  return row!
}
