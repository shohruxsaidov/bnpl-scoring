import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { merchantDocuments } from '@db/schema'

export async function listDocuments(db: Db, merchantId: number) {
  return db
    .select()
    .from(merchantDocuments)
    .where(eq(merchantDocuments.merchantId, merchantId))
    .orderBy(merchantDocuments.uploadedAt)
}
