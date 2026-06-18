import { db } from '@db';
import { users } from '@db/schema';
import type { CreateClientCommand } from './create-client.command';

export async function createClient(input: CreateClientCommand) {
  const [row] = await db
    .insert(users)
    .values({ ...input })
    .returning();
  return row!;
}
