import { integer, pgTable, serial, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

// Local ownership ledger for a client's Plumgate cards — source of truth for the
// mobile card list. Plumgate stays the rail (OTP add, remote delete); this table
// owns which cards belong to which user. Every row is an OTP-confirmed card.
export const userCards = pgTable(
  'user_cards',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Numeric Plumgate card id — required by DELETE UserCard/deleteUserCard.
    plumId: integer('plum_id').notNull(),
    maskedPan: varchar('masked_pan', { length: 25 }).notNull(),
    holderName: varchar('holder_name', { length: 100 }),
    expiry: varchar('expiry', { length: 5 }).notNull(), // "08/27"
    pcType: varchar('pc_type', { length: 10 }).notNull().$type<'uzcard' | 'humo'>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // Re-adding the same physical card is idempotent rather than duplicated.
    userPlumUq: uniqueIndex('user_cards_user_plum_uq').on(t.userId, t.plumId),
  }),
);
