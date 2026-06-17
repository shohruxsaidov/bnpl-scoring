import { integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/** Audit log of every admin-initiated broadcast. One row per send action. */
export const notificationBroadcasts = pgTable('notification_broadcasts', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminId: integer('admin_id').notNull(),
  /** 'employee' | 'merchant_employees' | 'client' | 'all_clients' */
  targetType: varchar('target_type', { length: 30 }).notNull(),
  /** employeeId, merchantId, or userId depending on targetType; null for all_clients */
  targetId: varchar('target_id', { length: 30 }),
  title: text('title').notNull(),
  body: text('body').notNull(),
  recipientCount: integer('recipient_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
