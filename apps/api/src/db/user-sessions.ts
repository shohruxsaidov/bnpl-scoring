import { integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';
import { userDevices } from './user-devices';

export const userSessions = pgTable('user_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // The trusted device this session belongs to. Every session is device-bound:
  // one active session per device, and /session refresh is pinned to it.
  deviceId: uuid('device_id')
    .notNull()
    .references(() => userDevices.id, { onDelete: 'cascade' }),
  sessionTokenHash: varchar('session_token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
