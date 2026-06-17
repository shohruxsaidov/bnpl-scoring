import { integer, pgTable, serial, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { deals } from './deals';
import { merchants } from './merchants';
import { branches } from './branches';

// ---------------------------------------------------------------------------
// buyouts
// One row per Deal, created atomically with the Deal when a Kontrakt is signed.
// Records the obligation Finsum Nasiya owes the Merchant (tan narxi sum).
// Processed manually by the Platform Admin — status flips pending → paid.
// ---------------------------------------------------------------------------
export const buyouts = pgTable('buyouts', {
  id: serial('id').primaryKey(),
  dealId: uuid('deal_id')
    .notNull()
    .references(() => deals.id),
  merchantId: integer('merchant_id')
    .notNull()
    .references(() => merchants.id),
  branchId: integer('branch_id')
    .notNull()
    .references(() => branches.id),
  amount: integer('amount').notNull(),
  // 'pending' | 'paid'
  status: varchar('status', { length: 10 }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
