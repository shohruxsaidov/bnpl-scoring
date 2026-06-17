import { integer, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { merchantUsers } from './merchant-users';

export const merchantUserSessions = pgTable('merchant_user_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantUserId: integer('merchant_user_id')
    .notNull()
    .references(() => merchantUsers.id, { onDelete: 'cascade' }),
  selectedRole: varchar('selected_role', { length: 50 }).notNull(),
  sessionTokenHash: varchar('session_token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});
