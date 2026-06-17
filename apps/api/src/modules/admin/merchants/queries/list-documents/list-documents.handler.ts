import { eq } from "drizzle-orm"
import { db } from '@db'
import { merchantDocuments } from '@db/schema'

export async function listDocuments(merchantId: number) {
  return db
    .select()
    .from(merchantDocuments)
    .where(eq(merchantDocuments.merchantId, merchantId))
    .orderBy(merchantDocuments.uploadedAt)
}
