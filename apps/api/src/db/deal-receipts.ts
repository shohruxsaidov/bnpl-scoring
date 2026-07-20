import { pgTable, uuid, timestamp, jsonb, varchar, uniqueIndex } from 'drizzle-orm/pg-core';
import { deals } from './deals';

// ---------------------------------------------------------------------------
// deal_receipts
// The fiscal receipt (чек) filed with the tax authority via EPOS for a Deal.
//
// The platform is a RESELLER, not a lender: Finsum Nasiya buys the goods from
// the Merchant and resells them on installment, so the receipt is filed under
// the singleton `organization` requisites — not the Merchant's. That is also
// why a single global EPOS_TOKEN / terminal is correct.
//
// The receipt covers deals.amount only (goods at cash price). The markup is a
// financing charge, not merchandise, and must never reach a fiscal document.
//
// One receipt per Deal, enforced by the unique index. The row is written as
// 'pending' BEFORE the EPOS call so it acts as the mutex — issuing a receipt
// is irreversible and EPOS accepts no idempotency key, so a second concurrent
// click must collide on the database, not on a disabled button. On success the
// row flips to 'created'; on failure it is DELETED (the detail lives in
// integration_logs). A row left in 'pending' therefore means exactly one
// thing: the process died mid-call and EPOS may hold a receipt we never
// recorded — a human must check EPOS before retrying.
//
// There is deliberately no 'refunded' status. A refund is a second fiscal
// document, not a status flip on the first; when refunds land they reopen the
// one-row-per-deal decision.
// ---------------------------------------------------------------------------
export const dealReceipts = pgTable(
  'deal_receipts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id),
    status: varchar('status', { length: 20 })
      .$type<'pending' | 'created'>()
      .notNull()
      .default('pending'),
    // Populated on success only.
    payload: jsonb('payload').$type<{
      terminalId: string;
      receiptSeq: string;
      fiscalSign: string;
      datetime: string;
      qrCodeUrl: string;
    }>(),
    // Full EPOS body, kept verbatim for reconciliation against the tax authority.
    rawResponse: jsonb('raw_response'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('deal_receipts_deal_id_uq').on(t.dealId)],
);
