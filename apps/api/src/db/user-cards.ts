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
    // Plumgate hands back TWO ids for a card and they are not interchangeable:
    //   plum_id      — «Идентификатор прикрепления», the attachment. Required by
    //                  DELETE UserCard/deleteUserCard.
    //   plum_card_id — «Идентификатор карты в системе My Uzcard», the card itself.
    //                  Required by Scoring/createScoringCard (plum_card pipeline).
    // Nullable: rows written before the two were told apart only ever stored the
    // attachment id, and there is no way to backfill the card id without re-reading
    // the card list from Plumgate.
    plumId: integer('plum_id').notNull(),
    plumCardId: varchar('plum_card_id', { length: 30 }),
    maskedPan: varchar('masked_pan', { length: 25 }).notNull(),
    holderName: varchar('holder_name', { length: 100 }),
    expiry: varchar('expiry', { length: 5 }).notNull(), // "08/27"
    pcType: varchar('pc_type', { length: 10 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    // Re-adding the same physical card is idempotent rather than duplicated.
    userPlumUq: uniqueIndex('user_cards_user_plum_uq').on(t.userId, t.plumId),
  }),
);
