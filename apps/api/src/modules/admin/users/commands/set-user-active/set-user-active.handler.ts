import { eq } from "drizzle-orm"
import { db } from '@db'
import { adminUsers } from '@db/schema'
import type { SetUserActiveCommand } from "./set-user-active.command"

export async function updateAdminUser({ id, ...input }: SetUserActiveCommand) {
  const [row] = await db
    .update(adminUsers)
    .set(input)
    .where(eq(adminUsers.id, id))
    .returning({ id: adminUsers.id })
  return row
}
