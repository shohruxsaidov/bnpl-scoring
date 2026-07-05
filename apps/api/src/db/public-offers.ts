import { integer, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { adminUsers } from './admin-users';
import { files } from './files';

// ---------------------------------------------------------------------------
// public_offers — one logical, versioned public-offer document. Each version
// carries two uploaded PDFs (uz + ru), referenced from the `files` table.
// Latest version wins: the current document is the row with the highest
// `version`. Versions are assigned in-app as MAX(version)+1; a version goes
// live on insert (no draft/staging flag), and is only created once both PDFs
// have been uploaded. Rows are append-only and immutable — a version a client
// accepted must never change. Accepted by clients at registration; see
// user_public_offer_acceptances.
// ---------------------------------------------------------------------------
export const publicOffers = pgTable(
  'public_offers',
  {
    id: serial('id').primaryKey(),
    version: integer('version').notNull(),
    // Admin-only bookkeeping note (e.g. "updated late-payment clause"). Never
    // shown to clients — they only ever see the PDFs.
    label: text('label'),
    fileUzId: integer('file_uz_id')
      .references(() => files.id)
      .notNull(),
    fileRuId: integer('file_ru_id')
      .references(() => files.id)
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: integer('created_by').references(() => adminUsers.id),
  },
  (t) => [uniqueIndex('public_offers_version_idx').on(t.version)],
);
