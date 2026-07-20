import { pgTable, uuid, integer, date, timestamp, json, varchar } from 'drizzle-orm/pg-core';
import { deals } from './deals';

export const dealReceipt = pgTable('deal_receipts', {
  dealId: uuid('deal_id')
    .notNull()
    .references(() => deals.id),
  payload: json('payload').$type<{
    terminalId: string;
    receiptSeq: string;
    fiscalSign: string;
    datetime: string;
    qrCodeUrl: string;
  }>(),
  status: varchar('status').$type<'created' | 'refunded'>().default('created'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
