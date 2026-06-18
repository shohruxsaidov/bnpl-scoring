import { and, eq, ilike, or } from 'drizzle-orm';
import { db } from '@db';
import { clients } from '@db/schema';

export async function searchClients(q: string, merchantId: number, limit = 20) {
  const term = `%${q}%`;
  return db
    .select()
    .from(clients)
    .where(
      and(
        eq(clients.merchantId, merchantId),
        or(
          ilike(clients.firstName, term),
          ilike(clients.lastName, term),
          ilike(clients.pinfl, term),
          ilike(clients.phone, term),
        ),
      ),
    )
    .limit(limit);
}

export async function findClientByPinflAndMerchant(pinfl: string, merchantId: number) {
  const [row] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.pinfl, pinfl), eq(clients.merchantId, merchantId)))
    .limit(1);
  return row;
}
