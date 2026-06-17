import type { Db } from "../../../../db"
import { merchantTariffs } from '@db/schema'

export async function assignTariff(db: Db, merchantId: number, tariffId: number) {
  await db.insert(merchantTariffs).values({ merchantId, tariffId }).onConflictDoNothing()
}
