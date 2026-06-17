import { db } from '@db';
import { branches } from '@db/schema';
import type { CreateBranchCommand } from './create-branch.command';

export async function createBranch(input: CreateBranchCommand) {
  const [row] = await db.insert(branches).values(input).returning();
  return row!;
}
