import { and, eq } from 'drizzle-orm';
import { db } from '@db';
import { merchantTariffs, tariffs } from '@db/schema';

export async function listTariffsForMerchant(merchantId: number) {
  const rows = await db
    .select({ tariff: tariffs })
    .from(merchantTariffs)
    .innerJoin(tariffs, eq(merchantTariffs.tariffId, tariffs.id))
    .where(and(eq(merchantTariffs.merchantId, merchantId), eq(tariffs.active, true)))
    .orderBy(tariffs.name);
  return rows.map((r) => r.tariff);
}
