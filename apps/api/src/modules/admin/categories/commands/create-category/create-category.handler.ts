import { db } from '@db'
import { categories } from '@db/schema'
import type { CreateCategoryInput } from './create-category.command'

export async function createCategory(input: CreateCategoryInput) {
  const [row] = await db.insert(categories).values(input).returning()
  return row!
}
