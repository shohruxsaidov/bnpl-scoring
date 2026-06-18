import { integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

export const clientDevices = pgTable('client_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  deviceId: varchar('device_id', { length: 255 }).notNull().unique(),
  fcmToken: text('fcm_token'),
  platform: varchar('platform', { length: 10 }).notNull().$type<'ios' | 'android'>(),
  appVersion: varchar('app_version', { length: 10 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
