import type { Db } from "../../../../db"
import { categories } from "../../../id/db/schema"

export async function listCategories(db: Db) {
  return db.select().from(categories).orderBy(categories.name)
}
