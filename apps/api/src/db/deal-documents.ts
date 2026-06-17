import { integer, pgTable, serial, timestamp, unique, uuid, varchar } from 'drizzle-orm/pg-core';
import { deals } from './deals';
import { files } from './files';

// ---------------------------------------------------------------------------
// deal_documents
// One row per document type per Deal. Currently only 'contract' (PDF).
// Unique constraint ensures one Contract per Deal; upsert replaces on regeneration.
// ---------------------------------------------------------------------------
export const dealDocuments = pgTable(
  'deal_documents',
  {
    id: serial('id').primaryKey(),
    dealId: uuid('deal_id')
      .notNull()
      .references(() => deals.id, { onDelete: 'cascade' }),
    fileId: integer('file_id')
      .notNull()
      .references(() => files.id),
    documentType: varchar('document_type', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.dealId, t.documentType)],
);
