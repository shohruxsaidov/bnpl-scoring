import { eq } from 'drizzle-orm';
import type { Db } from '../../../../db';
import { blacklist } from '../../../id/db/schema';

export async function removeBlacklistEntry(db: Db, id: number) {
  const [row] = await db.delete(blacklist).where(eq(blacklist.id, id)).returning();
  return row;
}
