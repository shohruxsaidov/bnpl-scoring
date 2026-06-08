import type { Db } from "../../../../db"
import { dealComments } from "../../../deals/db/schema"

export async function createDealComment(
  db: Db,
  dealId: string,
  adminUserId: bigint,
  text: string,
) {
  const [row] = await db
    .insert(dealComments)
    .values({ dealId, adminUserId, text })
    .returning({
      id: dealComments.id,
      createdAt: dealComments.createdAt,
    })
  return { id: row!.id.toString(), dealId, text, createdAt: row!.createdAt.toISOString() }
}
