import { eq } from 'drizzle-orm';
import { db } from '@db';
import { branches } from '@db/schema';
import type { UpdateBranchCommand } from './update-branch.command';

export async function updateBranch({ id, ...input }: UpdateBranchCommand) {
  const [row] = await db.update(branches).set(input).where(eq(branches.id, id)).returning();
  return row;
}
