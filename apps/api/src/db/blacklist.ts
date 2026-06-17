import { integer, pgTable, serial, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core';
import { adminUsers } from './admin-users';

export const blacklist = pgTable(
  'blacklist',
  {
    id: serial('id').primaryKey(),
    type: varchar('type', { length: 10 }).notNull(), // 'pinfl' | 'inn'
    value: varchar('value', { length: 20 }).notNull(),
    reason: text('reason'),
    addedByAdminId: integer('added_by_admin_id')
      .notNull()
      .references(() => adminUsers.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.type, t.value)],
);
