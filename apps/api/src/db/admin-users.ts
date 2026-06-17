import { boolean, integer, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';
import { roles } from './roles';

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 500 }).notNull(),
  fullName: varchar('full_name', { length: 200 }).notNull(),
  // Exactly one admin Role; nullable only to ease migration/backfill of existing rows.
  roleId: integer('role_id').references(() => roles.id),
  active: boolean('active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  createdById: integer('created_by_id'), // null for the initial seeded admin
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
