import { db } from '@db'
import { merchantTariffs } from '@db/schema'

export async function assignTariff(merchantId: number, tariffId: number) {
  await db.insert(merchantTariffs).values({ merchantId, tariffId }).onConflictDoNothing()
}
