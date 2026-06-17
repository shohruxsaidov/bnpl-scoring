import { eq } from "drizzle-orm"
import { db } from "@db"
import { roles } from '@db/schema'

export async function renameRole(id: number, name: string) {
  const [row] = await db.update(roles).set({ name }).where(eq(roles.id, id)).returning()
  return row
}
