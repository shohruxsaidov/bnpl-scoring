import { integer, numeric, pgTable, serial, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { deals } from './deals';
import { merchants } from './merchants';
import { branches } from './branches';
import { files } from './files';
import { adminUsers } from './admin-users';

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
  /** Buy-out obligation (tan narxi), in som. */
  amount: numeric('amount', { precision: 15, scale: 2, mode: 'number' }).notNull(),
  // 'pending' | 'paid'
  status: varchar('status', { length: 10 }).notNull().default('pending'),
  // The three columns below are written together, and only by the pending → paid
  // transition. Nullable only because rows paid before they existed cannot answer.
  /** Proof of payment the Admin attached when marking this paid. */
  documentFileId: integer('document_file_id').references(() => files.id),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  paidBy: integer('paid_by').references(() => adminUsers.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
