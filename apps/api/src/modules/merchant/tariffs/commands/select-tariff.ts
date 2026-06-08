import type { Db } from "../../../../db"
import { merchantTariffs } from "../../../id/db/schema"

export async function selectTariff(db: Db, merchantId: bigint, tariffId: bigint) {
  await db.insert(merchantTariffs).values({ merchantId, tariffId }).onConflictDoNothing()
}
