import { boolean, pgTable, serial, timestamp, unique, varchar } from 'drizzle-orm/pg-core';

export const roles = pgTable(
  'roles',
  {
    id: serial('id').primaryKey(),
    key: varchar('key', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    platform: varchar('platform', { length: 10 }).notNull(),
    isSuperAdmin: boolean('is_superadmin').notNull().default(false),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.platform, t.key)],
);
