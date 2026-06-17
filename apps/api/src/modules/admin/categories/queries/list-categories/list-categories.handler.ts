import { db } from '@db'
import { categories } from '@db/schema'

export async function listCategories() {
  return db.select().from(categories).orderBy(categories.name)
}
