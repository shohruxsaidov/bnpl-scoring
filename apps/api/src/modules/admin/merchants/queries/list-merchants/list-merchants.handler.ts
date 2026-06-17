import { db } from '@db'
import { merchants } from '@db/schema'

export async function listMerchants() {
  return db.select().from(merchants).orderBy(merchants.createdAt)
}
