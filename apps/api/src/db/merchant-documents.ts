import { integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { merchants } from './merchants';
import { adminUsers } from './admin-users';

export const merchantDocuments = pgTable('merchant_documents', {
  id: serial('id').primaryKey(),
  merchantId: integer('merchant_id')
    .notNull()
    .references(() => merchants.id),
  fileUrl: text('file_url').notNull(),
  documentType: varchar('document_type', { length: 50 }).notNull(),
  uploadedByAdminId: integer('uploaded_by_admin_id').references(() => adminUsers.id),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
});
