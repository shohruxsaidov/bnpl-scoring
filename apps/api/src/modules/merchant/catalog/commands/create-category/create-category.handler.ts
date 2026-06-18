import { db } from '@db';
import { categories } from '@db/schema';
import type { CreateCategoryCommand } from './create-category.command';

export async function createCategory(input: CreateCategoryCommand) {
  const [row] = await db.insert(categories).values(input).returning();
  return row!;
}
