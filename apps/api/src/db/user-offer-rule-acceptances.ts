import { integer, pgTable, serial, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users';
import { offerRules } from './offer-rules';

// ---------------------------------------------------------------------------
// user_offer_rule_acceptances — append-only legal-consent trail. One row per
// (user, offer_rules version) the client accepted, with the acceptance date.
// Written inside the registration myid-complete transaction that creates the
// user. Enforcement is one-time at registration; publishing a newer version
// does not force existing users to re-accept.
// ---------------------------------------------------------------------------
export const userOfferRuleAcceptances = pgTable(
  'user_offer_rule_acceptances',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .references(() => users.id)
      .notNull(),
    offerRulesId: integer('offer_rules_id')
      .references(() => offerRules.id)
      .notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('user_offer_rule_acceptances_user_rule_idx').on(t.userId, t.offerRulesId)],
);
