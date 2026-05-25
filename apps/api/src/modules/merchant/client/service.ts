import { and, eq, ilike, or } from "drizzle-orm";
import type { Db } from "../../../db/index.js";
import { clients } from "../../id/db/schema.js";

export async function searchClients(
  db: Db,
  q: string,
  merchantId: bigint,
  limit = 20,
) {
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
        ),
      ),
    )
    .limit(limit);
}

export async function findClientByPinflAndMerchant(
  db: Db,
  pinfl: string,
  merchantId: bigint,
) {
  const [row] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.pinfl, pinfl), eq(clients.merchantId, merchantId)))
    .limit(1);
  return row;
}

export async function createClient(
  db: Db,
  input: {
    phone: string;
    pinfl: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    gender: string;
    nationality: string;
    passportSerial: string | null;
    passportNumber: string | null;
    photoUrl: string | null;
    merchantId: bigint;
    branchId: bigint;
  },
) {
  const [row] = await db
    .insert(clients)
    .values({ ...input, myidVerifiedAt: new Date() })
    .returning();
  return row!;
}
