import { sql } from 'drizzle-orm';
import { check, integer, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

// Singleton: Finsum Nasiya's own legal requisites (the platform operator).
// Exactly one row may exist — enforced by the id = 1 check on the primary key.
export const organization = pgTable(
  'organization',
  {
    id: integer('id').primaryKey().default(1),
    name: varchar('name', { length: 200 }).notNull(),
    legalName: varchar('legal_name', { length: 200 }).notNull(),
    directorName: varchar('director_name', { length: 200 }),
    address: text('address').notNull(),
    phone: varchar('phone', { length: 20 }).notNull(),
    inn: varchar('inn', { length: 9 }).notNull(),
    mfo: varchar('mfo', { length: 5 }).notNull(),
    accountNumber: varchar('account_number', { length: 20 }).notNull(),
    bankName: varchar('bank_name', { length: 200 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [check('organization_singleton', sql`${table.id} = 1`)],
);
