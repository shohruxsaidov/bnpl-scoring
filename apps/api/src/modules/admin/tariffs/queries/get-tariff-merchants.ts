import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { merchantTariffs, merchants } from "../../../id/db/schema"

export async function getTariffMerchants(db: Db, tariffId: number) {
  return db
    .select({
      id: merchants.id,
      name: merchants.name,
      legalName: merchants.legalName,
      inn: merchants.inn,
      active: merchants.active,
      addedAt: merchantTariffs.addedAt,
    })
    .from(merchantTariffs)
    .innerJoin(merchants, eq(merchantTariffs.merchantId, merchants.id))
    .where(eq(merchantTariffs.tariffId, tariffId))
    .orderBy(merchants.name)
}
