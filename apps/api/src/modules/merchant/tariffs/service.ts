import { and, eq } from 'drizzle-orm'
import type { Db } from '../../../db/index.js'
import { merchantTariffs, tariffs } from '../../id/db/schema.js'

export async function listTariffsForMerchant(db: Db, merchantId: bigint) {
  const [all, selected] = await Promise.all([
    db.select().from(tariffs).where(eq(tariffs.active, true)).orderBy(tariffs.name),
    db.select().from(merchantTariffs).where(eq(merchantTariffs.merchantId, merchantId)),
  ])
  const selectedIds = new Set(selected.map((s) => s.tariffId.toString()))
  return all.map((t) => ({ ...t, selected: selectedIds.has(t.id.toString()) }))
}

export async function selectTariff(db: Db, merchantId: bigint, tariffId: bigint) {
  await db.insert(merchantTariffs).values({ merchantId, tariffId }).onConflictDoNothing()
}

export async function deselectTariff(db: Db, merchantId: bigint, tariffId: bigint) {
  await db
    .delete(merchantTariffs)
    .where(and(eq(merchantTariffs.merchantId, merchantId), eq(merchantTariffs.tariffId, tariffId)))
}
