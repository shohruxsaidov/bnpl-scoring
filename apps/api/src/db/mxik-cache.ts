import { integer, jsonb, pgTable, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const mxikCache = pgTable('mxik_cache', {
  mxikCode: varchar('mxik_code', { length: 50 }).primaryKey(),
  mxikName: text('mxik_name'),
  label: integer('label'),
  brandName: varchar('brand_name', { length: 200 }),
  groupName: text('group_name'),
  className: text('class_name'),
  packages: jsonb('packages'),
  rawResponse: jsonb('raw_response'),
  cachedAt: timestamp('cached_at', { withTimezone: true }).defaultNow().notNull(),
});
