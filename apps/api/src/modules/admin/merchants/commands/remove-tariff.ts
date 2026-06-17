import { and, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { merchantTariffs } from "../../../id/db/schema"

export async function removeTariff(db: Db, merchantId: number, tariffId: number) {
  await db
    .delete(merchantTariffs)
    .where(and(eq(merchantTariffs.merchantId, merchantId), eq(merchantTariffs.tariffId, tariffId)))
}
