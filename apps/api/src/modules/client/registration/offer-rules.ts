import { and, desc, eq } from 'drizzle-orm';
import { db } from '@db';
import { offerRules } from '@db/offer-rules';

// The document type accepted during client registration. Only value for now.
export const REGISTRATION_OFFER_TYPE = 'registration';

// Current document for a type = highest-version row (latest wins).
export async function getCurrentOfferRule(type: string) {
  const [row] = await db
    .select()
    .from(offerRules)
    .where(eq(offerRules.type, type))
    .orderBy(desc(offerRules.version))
    .limit(1);
  return row ?? null;
}

// Validate a client-submitted acceptance: the id must exist, be of the given
// type, and still be the current (highest) version — stale acceptances are
// rejected so a client can't accept a superseded document.
export async function findCurrentOfferRuleById(id: number, type: string) {
  const current = await getCurrentOfferRule(type);
  if (!current || current.id !== id) return null;
  // Defensive: ensure the row really is of this type.
  const [row] = await db
    .select()
    .from(offerRules)
    .where(and(eq(offerRules.id, id), eq(offerRules.type, type)))
    .limit(1);
  return row ?? null;
}
