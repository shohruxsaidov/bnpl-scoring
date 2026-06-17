import { eq } from 'drizzle-orm';
import type { Db } from '../../../../db';
import { branches } from '../../../id/db/schema';

export async function updateBranch(
  db: Db,
  id: number,
  input: Partial<{ name: string; address: string; phone: string; active: boolean }>,
) {
  const [row] = await db.update(branches).set(input).where(eq(branches.id, id)).returning();
  return row;
}
