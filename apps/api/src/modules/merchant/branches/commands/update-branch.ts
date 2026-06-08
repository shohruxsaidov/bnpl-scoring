import { and, eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { branches } from "../../../id/db/schema"

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
