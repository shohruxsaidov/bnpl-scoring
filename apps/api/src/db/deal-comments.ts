import { integer, pgTable, serial, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { deals } from './deals';
import { adminUsers } from './admin-users';

// ---------------------------------------------------------------------------
// deal_comments
// Admin-authored notes on a deal. Append-only, not editable or deletable.
// ---------------------------------------------------------------------------
export const dealComments = pgTable('deal_comments', {
  id: serial('id').primaryKey(),
  dealId: uuid('deal_id')
    .notNull()
    .references(() => deals.id, { onDelete: 'cascade' }),
  adminUserId: integer('admin_user_id')
    .notNull()
    .references(() => adminUsers.id),
  text: text('text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
