import { boolean, integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { merchants } from './merchants';
import { branches } from './branches';

export const merchantUsers = pgTable('merchant_users', {
  id: serial('id').primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 500 }).notNull(),
  fullName: varchar('full_name', { length: 200 }).notNull(),
  merchantId: integer('merchant_id')
    .notNull()
    .references(() => merchants.id),
  branchId: integer('branch_id')
    .notNull()
    .references(() => branches.id),
  roles: text('roles').array().notNull(),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
