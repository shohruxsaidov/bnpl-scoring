import type { Db } from "../../../../db"
import { categories } from '@db/schema'

export async function createCategory(db: Db, input: { name: string }) {
  const [row] = await db.insert(categories).values(input).returning()
  return row!
}
