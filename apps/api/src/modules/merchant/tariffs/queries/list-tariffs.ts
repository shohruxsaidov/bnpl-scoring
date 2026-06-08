import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { merchantTariffs, tariffs } from "../../../id/db/schema"

export async function listTariffsForMerchant(db: Db, merchantId: bigint) {
  const [all, selected] = await Promise.all([
    db.select().from(tariffs).where(eq(tariffs.active, true)).orderBy(tariffs.name),
    db.select().from(merchantTariffs).where(eq(merchantTariffs.merchantId, merchantId)),
  ])
  const selectedIds = new Set(selected.map((s) => s.tariffId.toString()))
  return all.map((t) => ({ ...t, selected: selectedIds.has(t.id.toString()) }))
}
