import type { Db } from "../../../../db"
import { merchantDocuments } from "../../../id/db/schema"

export async function recordDocument(
  db: Db,
  input: {
    merchantId: bigint
    fileUrl: string
    documentType: string
    uploadedByAdminId: bigint
  },
) {
  const [row] = await db.insert(merchantDocuments).values(input).returning()
  return row!
}
