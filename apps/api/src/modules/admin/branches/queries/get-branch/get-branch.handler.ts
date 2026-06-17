import { eq } from 'drizzle-orm';
import { db } from '@db';
import { branches } from '@db/schema';

export async function getBranch(id: number) {
  const [row] = await db.select().from(branches).where(eq(branches.id, id)).limit(1);
  return row;
}
