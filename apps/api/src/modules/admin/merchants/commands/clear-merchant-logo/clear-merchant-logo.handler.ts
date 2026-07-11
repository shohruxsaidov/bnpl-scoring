import { eq } from "drizzle-orm"
import { db } from '@db'
import { merchants } from '@db/schema'

// Drops the merchant's logo and reports the file it was using, so the caller can
// delete it after the transaction commits (same ordering rule as setMerchantLogo).
// The UI falls back to the letter avatar once this returns.
export async function clearMerchantLogo(merchantId: number) {
  return db.transaction(async (tx) => {
    const [previous] = await tx
      .select({ logoFileId: merchants.logoFileId })
      .from(merchants)
      .where(eq(merchants.id, merchantId))
      .limit(1)

    const [merchant] = await tx
      .update(merchants)
      .set({ logoFileId: null })
      .where(eq(merchants.id, merchantId))
      .returning()

    return { merchant: merchant!, previousFileId: previous?.logoFileId ?? null }
  })
}
