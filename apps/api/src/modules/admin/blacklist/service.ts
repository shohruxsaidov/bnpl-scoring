import { desc, eq } from 'drizzle-orm'
import type { Db } from '../../../db/index.js'
import { blacklist, adminUsers } from '../../id/db/schema.js'

export async function listBlacklist(db: Db) {
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

export async function addBlacklistEntry(
  db: Db,
  input: { type: string; value: string; reason: string | null; addedByAdminId: bigint },
) {
  const [row] = await db.insert(blacklist).values(input).returning()
  return row!
}

export async function removeBlacklistEntry(db: Db, id: bigint) {
  const [row] = await db.delete(blacklist).where(eq(blacklist.id, id)).returning()
  return row
}

export async function getAdminById(db: Db, id: bigint) {
  const [row] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1)
  return row
}
