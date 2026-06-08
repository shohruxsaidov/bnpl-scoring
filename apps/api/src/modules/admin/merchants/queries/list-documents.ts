import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { merchantDocuments } from "../../../id/db/schema"

export async function listDocuments(db: Db, merchantId: bigint) {
  return db
    .select()
    .from(merchantDocuments)
    .where(eq(merchantDocuments.merchantId, merchantId))
    .orderBy(merchantDocuments.uploadedAt)
}
