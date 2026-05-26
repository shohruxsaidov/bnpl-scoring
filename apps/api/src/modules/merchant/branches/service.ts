import { eq, and } from "drizzle-orm"
import type { Db } from "../../../db"
import { branches } from "../../id/db/schema"

export async function listBranches(db: Db, merchantId: bigint) {
  return db.select().from(branches).where(eq(branches.merchantId, merchantId)).orderBy(branches.createdAt)
}

export async function createBranch(db: Db, input: { merchantId: bigint; name: string; address: string; phone: string }) {
  const [row] = await db.insert(branches).values(input).returning()
  return row!
}

export async function updateBranch(
  db: Db,
  id: bigint,
  merchantId: bigint,
  input: Partial<{ name: string; address: string; phone: string; active: boolean }>,
) {
  const [row] = await db
    .update(branches)
    .set(input)
    .where(and(eq(branches.id, id), eq(branches.merchantId, merchantId)))
    .returning()
  return row
}
