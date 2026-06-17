import { desc, eq } from "drizzle-orm"
import { db } from "@db"
import { blacklist, adminUsers } from '@db/schema'

export async function listBlacklist() {
  return db
    .select({
      id: blacklist.id,
      type: blacklist.type,
      value: blacklist.value,
      reason: blacklist.reason,
      addedByAdminId: blacklist.addedByAdminId,
      addedByName: adminUsers.fullName,
      createdAt: blacklist.createdAt,
    })
    .from(blacklist)
    .leftJoin(adminUsers, eq(blacklist.addedByAdminId, adminUsers.id))
    .orderBy(desc(blacklist.createdAt))
}
