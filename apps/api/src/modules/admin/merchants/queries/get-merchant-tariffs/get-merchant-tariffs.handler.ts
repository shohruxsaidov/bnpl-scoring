import { eq } from "drizzle-orm"
import { db } from '@db'
import { tariffs, merchantTariffs } from '@db/schema'

export async function getMerchantTariffs(merchantId: number) {
  const [all, selected] = await Promise.all([
    db.select().from(tariffs).where(eq(tariffs.active, true)).orderBy(tariffs.name),
    db.select().from(merchantTariffs).where(eq(merchantTariffs.merchantId, merchantId)),
  ])
  const selectedIds = new Set(selected.map((s) => s.tariffId.toString()))
  return all.map((t) => ({
    id: t.id.toString(),
    name: t.name,
    termMonths: t.termMonths,
    markupPercent: parseFloat(t.markupPercent),
    active: t.active,
    selected: selectedIds.has(t.id.toString()),
  }))
}
