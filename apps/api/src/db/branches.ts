import {
  boolean,
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { merchants } from './merchants';
import { regions } from './regions';

// A merchant is a legal entity; a branch is the place with a door. Coordinates
// therefore live here, not on merchants. They are nullable as a pair — set
// together, cleared together — because a branch with only a latitude is not a
// half-located branch, it is a broken row.
export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  merchantId: integer('merchant_id')
    .notNull()
    .references(() => merchants.id),
  name: varchar('name', { length: 200 }).notNull(),
  address: text('address').notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  regionId: integer('region_id').references(() => regions.id),
  latitude: doublePrecision('latitude'),
  longitude: doublePrecision('longitude'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
