import type { Db } from "../../../../db"
import { merchantDocuments } from '@db/schema'

export async function recordDocument(
  db: Db,
  input: {
    merchantId: number
    fileUrl: string
    documentType: string
    uploadedByAdminId: number
  },
) {
  const [row] = await db.insert(merchantDocuments).values(input).returning()
  return row!
}
