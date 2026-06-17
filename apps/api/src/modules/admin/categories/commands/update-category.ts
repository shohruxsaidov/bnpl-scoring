import { eq } from 'drizzle-orm';
import type { Db } from '../../../../db';
import { categories } from '../../../id/db/schema';

export async function updateCategory(
  db: Db,
  id: number,
  input: Partial<{ name: string; active: boolean }>,
) {
  const [row] = await db.update(categories).set(input).where(eq(categories.id, id)).returning();
  return row;
}
