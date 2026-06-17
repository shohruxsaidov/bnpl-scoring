import { db } from '@db';
import { blacklist } from '@db/schema';
import type { AddBlacklistEntryInput } from './add-to-blacklist.command';

export async function addBlacklistEntry(input: AddBlacklistEntryInput) {
  const [row] = await db.insert(blacklist).values(input).returning();
  return row!;
}
