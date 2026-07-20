import { integer, jsonb, numeric, pgTable, serial, uuid, varchar } from 'drizzle-orm/pg-core';
import { deals } from './deals';
import { products } from './products';

// ---------------------------------------------------------------------------
// deal_items
// Normalized Basket — one row per Product line in the Deal.
// Snapshot fields (product_name, price, mxik_code, package_*) are
// denormalized at Deal creation time so Product edits don't alter past Deals.
// ---------------------------------------------------------------------------
export const dealItems = pgTable('deal_items', {
  id: serial('id').primaryKey(),
  dealId: uuid('deal_id')
    .notNull()
    .references(() => deals.id, { onDelete: 'cascade' }),
  // nullable — product may be deleted after Deal creation; snapshot fields remain
  productId: integer('product_id').references(() => products.id),
  // snapshot at time of Deal creation
  productName: varchar('product_name', { length: 200 }).notNull(),
  price: numeric('price', { precision: 15, scale: 2 }).notNull(),
  mxikCode: varchar('mxik_code', { length: 50 }),
  packageCode: integer('package_code'),
  packageName: varchar('package_name', { length: 200 }),
  // Snapshot of products.vat_percent at Deal creation. Snapshotted rather than
  // joined because a fiscal receipt issued later must state the VAT rate that
  // applied to the sale, not whatever the Product carries today.
  vatPercent: integer('vat_percent').notNull().default(12),
  quantity: integer('quantity').notNull().default(1),
  // Per-unit marking codes (markirovka) for labeled products; [] for unlabeled.
  // labels.length === quantity when the snapshot product was labeled.
  labels: jsonb('labels').$type<string[]>().notNull().default([]),
});
