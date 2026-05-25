import { eq } from "drizzle-orm"
import type { Db } from "../../../db"
import { branches } from "../../id/db/schema"

export async function listBranches(db: Db, merchantId: bigint) {
  return db.select().from(branches).where(eq(branches.merchantId, merchantId)).orderBy(branches.createdAt)
}

export async function getBranch(db: Db, id: bigint) {
  const [row] = await db.select().from(branches).where(eq(branches.id, id)).limit(1)
  return row
}

export async function createBranch(
  db: Db,
  input: { merchantId: bigint; name: string; address: string; phone: string },
) {
  const [row] = await db.insert(branches).values(input).returning()
  return row!
}

export async function updateBranch(
  db: Db,
  id: bigint,
  input: Partial<{ name: string; address: string; phone: string; active: boolean }>,
) {
  const [row] = await db.update(branches).set(input).where(eq(branches.id, id)).returning()
  return row
}
