import { integer, pgTable, primaryKey, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants';
import { tariffs } from './tariffs';

export const merchantTariffs = pgTable(
  'merchant_tariffs',
  {
    merchantId: integer('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    tariffId: integer('tariff_id')
      .notNull()
      .references(() => tariffs.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.merchantId, t.tariffId] })],
);
