import { eq } from 'drizzle-orm';
import { db } from '@db';
import { categories } from '@db/schema';

export async function getCategory(id: number) {
  const [row] = await db.select().from(categories).where(eq(categories.id, id)).limit(1);
  return row;
}
