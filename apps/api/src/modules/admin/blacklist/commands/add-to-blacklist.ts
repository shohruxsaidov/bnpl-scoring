import type { Db } from "../../../../db"
import { blacklist } from "../../../id/db/schema"

export async function addBlacklistEntry(
  db: Db,
  input: { type: string; value: string; reason: string | null; addedByAdminId: bigint },
) {
  const [row] = await db.insert(blacklist).values(input).returning()
  return row!
}
