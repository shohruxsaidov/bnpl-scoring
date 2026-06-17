import { boolean, integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { merchants } from './merchants';
import { regions } from './regions';

export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  merchantId: integer('merchant_id')
    .notNull()
    .references(() => merchants.id),
  name: varchar('name', { length: 200 }).notNull(),
  address: text('address').notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  regionId: integer('region_id').references(() => regions.id),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
