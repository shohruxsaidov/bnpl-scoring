import { integer, pgTable, serial, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';
import { publicOffers } from './public-offers';

// ---------------------------------------------------------------------------
// user_public_offer_acceptances — append-only legal-consent trail. One row per
// (user, public_offers version) the client accepted, with the acceptance date.
// Written inside the registration myid-complete transaction that creates the
// user. Enforcement is one-time at registration; publishing a newer version
// does not force existing users to re-accept. An acceptance of a version
// covers both language PDFs of that version.
// ---------------------------------------------------------------------------
export const userPublicOfferAcceptances = pgTable(
  'user_public_offer_acceptances',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    publicOfferId: integer('public_offer_id')
      .references(() => publicOffers.id)
      .notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('user_public_offer_acceptances_user_offer_idx').on(t.userId, t.publicOfferId)],
);
