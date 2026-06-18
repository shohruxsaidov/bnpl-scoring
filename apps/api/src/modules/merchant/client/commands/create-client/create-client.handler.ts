import { db } from '@db';
import { clients } from '@db/schema';
import type { CreateClientCommand } from './create-client.command';

export async function createClient(input: CreateClientCommand) {
  const [row] = await db
    .insert(clients)
    .values({ ...input, myidVerifiedAt: new Date() })
    .returning();
  return row!;
}
