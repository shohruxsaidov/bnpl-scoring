import { and, eq } from "drizzle-orm"
import { db } from '@db'
import { merchantTariffs } from '@db/schema'

export async function removeTariff(merchantId: number, tariffId: number) {
  await db
    .delete(merchantTariffs)
    .where(and(eq(merchantTariffs.merchantId, merchantId), eq(merchantTariffs.tariffId, tariffId)))
}
