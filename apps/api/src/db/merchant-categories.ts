import { integer, pgTable, primaryKey } from 'drizzle-orm/pg-core';
import { categories } from './categories';
import { merchants } from './merchants';

export const merchantCategories = pgTable(
  'merchant_categories',
  {
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    merchantId: integer('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.merchantId] })],
);
