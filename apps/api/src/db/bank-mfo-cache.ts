import { pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const bankMfoCache = pgTable('bank_mfo_cache', {
  mfo: varchar('mfo', { length: 5 }).primaryKey(),
  bankName: text('bank_name').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
});
