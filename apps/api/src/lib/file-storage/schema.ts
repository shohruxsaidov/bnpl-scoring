import { bigint, bigserial, timestamp, text, varchar, pgTable } from 'drizzle-orm/pg-core';

export const files = pgTable('files', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  objectKey: text('object_key').notNull(),
  bucket: varchar('bucket', { length: 100 }).notNull(),
  mimeType: varchar('mime_type', { length: 100 }),
  originalName: varchar('original_name', { length: 255 }),
  uploadedByType: varchar('uploaded_by_type', { length: 20 })
    .notNull()
    .$type<'admin' | 'merchant_user' | 'system'>(),
  uploadedById: bigint('uploaded_by_id', { mode: 'bigint' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type FileRecord = typeof files.$inferSelect;
