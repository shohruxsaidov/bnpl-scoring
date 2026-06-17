import type { Db } from "../../../../db"
import { merchants } from '@db/schema'

export async function listMerchants(db: Db) {
  return db.select().from(merchants).orderBy(merchants.createdAt)
}
