import type { Db } from "../../../../db"
import { roles } from "../../../id/db/schema"
import type { Platform } from "../../../../rbac/features"

export async function createRole(
  db: Db,
  input: { platform: Platform; key: string; name: string },
) {
  const [row] = await db
    .insert(roles)
    .values({ platform: input.platform, key: input.key, name: input.name })
    .returning()
  return row!
}
