import { desc, eq } from 'drizzle-orm';
import { db } from '@db';
import { publicOffers } from '@db/public-offers';

// Current public offer = highest-version row (latest wins).
export async function getCurrentPublicOffer() {
  const [row] = await db.select().from(publicOffers).orderBy(desc(publicOffers.version)).limit(1);
  return row ?? null;
}

// Validate a client-submitted acceptance: the id must exist and still be the
// current (highest) version — stale acceptances are rejected so a client can't
// accept a superseded document.
export async function findCurrentPublicOfferById(id: number) {
  const current = await getCurrentPublicOffer();
  if (!current || current.id !== id) return null;
  return current;
}
