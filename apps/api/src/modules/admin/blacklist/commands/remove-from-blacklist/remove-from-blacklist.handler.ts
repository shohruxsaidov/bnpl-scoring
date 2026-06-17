import { eq } from 'drizzle-orm';
import { db } from '@db';
import { blacklist } from '@db/schema';

export async function removeBlacklistEntry(id: number) {
  const [row] = await db.delete(blacklist).where(eq(blacklist.id, id)).returning();
  return row;
}
