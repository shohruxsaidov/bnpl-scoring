import { eq } from "drizzle-orm"
import { db } from '@db'
import { merchants } from '@db/schema'
import { recordFile } from "../../../../../lib/file-storage"
import type { SetMerchantLogoCommand } from "./set-merchant-logo.command"

// Points the merchant at a newly stored logo object and reports which file it
// replaced. The caller is responsible for deleting that previous file, and must
// only do so once this transaction has committed: an orphaned object in storage
// is harmless, whereas a row pointing at bytes we already removed is not.
export async function setMerchantLogo(cmd: SetMerchantLogoCommand) {
  return db.transaction(async (tx) => {
    const file = await recordFile(tx, {
      objectKey: cmd.objectKey,
      mimeType: cmd.mimeType,
      originalName: cmd.originalName,
      uploadedByType: 'admin',
      uploadedById: cmd.uploadedByAdminId,
    })

    const [previous] = await tx
      .select({ logoFileId: merchants.logoFileId })
      .from(merchants)
      .where(eq(merchants.id, cmd.merchantId))
      .limit(1)

    const [merchant] = await tx
      .update(merchants)
      .set({ logoFileId: file.id })
      .where(eq(merchants.id, cmd.merchantId))
      .returning()

    return { merchant: merchant!, previousFileId: previous?.logoFileId ?? null }
  })
}
