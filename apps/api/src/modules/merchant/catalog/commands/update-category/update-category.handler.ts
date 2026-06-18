import { eq } from 'drizzle-orm';
import { db } from '@db';
import { categories } from '@db/schema';

export async function updateCategory(
  id: number,
  input: Partial<{ name: string; active: boolean }>,
) {
  const [row] = await db
    .update(categories)
    .set(input)
    .where(eq(categories.id, id))
    .returning();
  return row;
}
