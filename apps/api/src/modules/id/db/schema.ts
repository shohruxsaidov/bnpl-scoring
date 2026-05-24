import { bigint, bigserial, boolean, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  pinfl: varchar('pinfl', { length: 14 }).notNull().unique(),
  fullName: varchar('full_name', { length: 200 }).notNull(),
  myidVerifiedAt: timestamp('myid_verified_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const clientSessions = pgTable('client_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: bigserial('user_id', { mode: 'bigint' }).notNull().references(() => users.id, { onDelete: 'cascade' }),
  sessionTokenHash: varchar('session_token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
})

export const otpVerifications = pgTable('otp_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: varchar('phone', { length: 20 }).notNull(),
  code: varchar('code', { length: 10 }).notNull(),
  purpose: varchar('purpose', { length: 20 }).notNull(), // 'login' | 'register'
  usedAt: timestamp('used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// merchant_id and branch_id reference merchants/branches tables not yet built.
export const merchantUsers = pgTable('merchant_users', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 500 }).notNull(),
  fullName: varchar('full_name', { length: 200 }).notNull(),
  merchantId: bigint('merchant_id', { mode: 'bigint' }).notNull(),
  branchId: bigint('branch_id', { mode: 'bigint' }).notNull(),
  roles: text('roles').array().notNull(), // e.g. ['agent', 'merchant_admin']
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const merchantSessions = pgTable('merchant_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantUserId: bigint('merchant_user_id', { mode: 'bigint' })
    .notNull()
    .references(() => merchantUsers.id, { onDelete: 'cascade' }),
  selectedRole: varchar('selected_role', { length: 50 }).notNull(),
  sessionTokenHash: varchar('session_token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
})
