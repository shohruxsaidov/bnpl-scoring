import { and, eq } from 'drizzle-orm';
import type { Db } from '../../../../db';
import { merchantTariffs, tariffs } from '../../../id/db/schema';

export async function listTariffsForMerchant(db: Db, merchantId: number) {
  const rows = await db
    .select({ tariff: tariffs })
    .from(merchantTariffs)
    .innerJoin(tariffs, eq(merchantTariffs.tariffId, tariffs.id))
    .where(and(eq(merchantTariffs.merchantId, merchantId), eq(tariffs.active, true)))
    .orderBy(tariffs.name);
  return rows.map((r) => r.tariff);
}
