import {
  boolean,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';

export const tariffs = pgTable('tariffs', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  termMonths: integer('term_months').notNull(),
  markupPercent: numeric('markup_percent', { precision: 5, scale: 2 }).notNull(),
  // Credit Range (som); null bound = unbounded on that side
  minAmount: numeric('min_amount', { precision: 15, scale: 2 }),
  maxAmount: numeric('max_amount', { precision: 15, scale: 2 }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
