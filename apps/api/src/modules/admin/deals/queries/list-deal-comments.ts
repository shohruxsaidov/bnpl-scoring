import { asc, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { dealComments } from "../../../deals/db/schema"
import { adminUsers } from '@db/schema'

export async function listDealComments(db: Db, dealId: string) {
  const rows = await db
    .select({
      id: dealComments.id,
      text: dealComments.text,
      createdAt: dealComments.createdAt,
      authorName: adminUsers.fullName,
    })
    .from(dealComments)
    .innerJoin(adminUsers, eq(dealComments.adminUserId, adminUsers.id))
    .where(eq(dealComments.dealId, dealId))
    .orderBy(asc(dealComments.createdAt))

  return rows.map((r) => ({
    id: r.id.toString(),
    text: r.text,
    createdAt: r.createdAt.toISOString(),
    authorName: r.authorName,
  }))
}
