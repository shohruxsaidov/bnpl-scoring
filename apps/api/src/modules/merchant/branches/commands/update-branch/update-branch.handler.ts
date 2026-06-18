import { and, eq } from 'drizzle-orm';
import { db } from '@db';
import { branches } from '@db/schema';

export async function updateBranch(
  id: number,
  merchantId: number,
  input: Partial<{ name: string; address: string; phone: string; active: boolean }>,
) {
  const [row] = await db
    .update(branches)
    .set(input)
    .where(and(eq(branches.id, id), eq(branches.merchantId, merchantId)))
    .returning();
  return row;
}
