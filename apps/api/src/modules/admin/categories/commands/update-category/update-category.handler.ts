import { eq } from 'drizzle-orm';
import { db } from '@db';
import { categories } from '@db/schema';
import type { UpdateCategoryInput } from './update-category.command';

export async function updateCategory({ id, data }: UpdateCategoryInput) {
  const [row] = await db.update(categories).set(data).where(eq(categories.id, id)).returning();
  return row;
}
