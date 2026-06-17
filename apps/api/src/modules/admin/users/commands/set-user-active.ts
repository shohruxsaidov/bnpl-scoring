import { eq } from "drizzle-orm"
import type { Db } from "../../../../db"
import { adminUsers } from "../../../id/db/schema"

export async function updateAdminUser(
  db: Db,
  id: number,
  input: Partial<{ active: boolean }>,
) {
  const [row] = await db
    .update(adminUsers)
    .set(input)
    .where(eq(adminUsers.id, id))
    .returning({ id: adminUsers.id })
  return row
}
