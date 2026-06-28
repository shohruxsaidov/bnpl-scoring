import { boolean, integer, numeric, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';
import { merchants } from './merchants';
import { categories } from './categories';

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  merchantId: integer('merchant_id')
    .notNull()
    .references(() => merchants.id),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id),
  name: varchar('name', { length: 200 }).notNull(),
  price: numeric('price', { precision: 15, scale: 2 }).notNull(),
  mxikCode: varchar('mxik_code', { length: 50 }),
  packageCode: integer('package_code'),
  packageName: varchar('package_name', { length: 200 }),
  isLabeled: boolean('is_labeled').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
