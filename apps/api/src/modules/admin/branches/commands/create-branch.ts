import type { Db } from '../../../../db';
import { branches } from '@db/schema';

export async function createBranch(
  db: Db,
  input: { merchantId: number; name: string; address: string; phone: string },
) {
  const [row] = await db.insert(branches).values(input).returning();
  return row!;
}
