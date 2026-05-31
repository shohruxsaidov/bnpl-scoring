import {
  bigint,
  bigserial,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// RBAC roles. Custom, global templates managed from the admin platform.
// `key` is a stable slug (e.g. 'agent', 'superadmin'); seeded system roles rely on it.
export const roles = pgTable(
  'roles',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    key: varchar('key', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    platform: varchar('platform', { length: 10 }).notNull(), // 'merchant' | 'admin'
    isSuperadmin: boolean('is_superadmin').notNull().default(false),
    isSystem: boolean('is_system').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.platform, t.key)],
);

// Default-deny grant list: a row means the Feature is granted to the Role.
// Superadmin bypasses this table entirely (treated as holding every Feature).
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: bigint('role_id', { mode: 'bigint' })
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    feature: varchar('feature', { length: 50 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.feature] })],
);

export const users = pgTable('users', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  pinfl: varchar('pinfl', { length: 14 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  middleName: varchar('middle_name', { length: 100 }),
  birthDate: date('birth_date').notNull(),
  gender: varchar('gender', { length: 10 }).notNull(),
  nationality: varchar('nationality', { length: 100 }).notNull(),
  passportSerial: varchar('passport_serial', { length: 5 }),
  passportNumber: varchar('passport_number', { length: 10 }),
  photoUrl: text('photo_url'),
  myidVerifiedAt: timestamp('myid_verified_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const clientSessions = pgTable('client_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: bigserial('user_id', { mode: 'bigint' })
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionTokenHash: varchar('session_token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

export const otpVerifications = pgTable('otp_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  phone: varchar('phone', { length: 20 }).notNull(),
  code: varchar('code', { length: 10 }).notNull(),
  purpose: varchar('purpose', { length: 20 }).notNull(), // 'login' | 'register'
  usedAt: timestamp('used_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const clients = pgTable(
  'clients',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    phone: varchar('phone', { length: 20 }).notNull(),
    pinfl: varchar('pinfl', { length: 14 }).notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    middleName: varchar('middle_name', { length: 100 }),
    birthDate: date('birth_date').notNull(),
    gender: varchar('gender', { length: 10 }).notNull(),
    nationality: varchar('nationality', { length: 100 }).notNull(),
    passportSerial: varchar('passport_serial', { length: 5 }),
    passportNumber: varchar('passport_number', { length: 10 }),
    photoUrl: text('photo_url'),
    myidVerifiedAt: timestamp('myid_verified_at', { withTimezone: true }).notNull(),
    merchantId: bigint('merchant_id', { mode: 'bigint' }).notNull(),
    branchId: bigint('branch_id', { mode: 'bigint' }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.pinfl, t.merchantId)],
);

export const adminUsers = pgTable('admin_users', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 500 }).notNull(),
  fullName: varchar('full_name', { length: 200 }).notNull(),
  // Exactly one admin Role; nullable only to ease migration/backfill of existing rows.
  roleId: bigint('role_id', { mode: 'bigint' }).references(() => roles.id),
  active: boolean('active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  createdById: bigint('created_by_id', { mode: 'bigint' }), // null for the initial seeded admin
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const adminSessions = pgTable('admin_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminUserId: bigint('admin_user_id', { mode: 'bigint' })
    .notNull()
    .references(() => adminUsers.id, { onDelete: 'cascade' }),
  sessionTokenHash: varchar('session_token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

// merchant_id and branch_id reference merchants/branches tables not yet built.
export const merchants = pgTable('merchants', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  legalName: varchar('legal_name', { length: 200 }).notNull(),
  inn: varchar('inn', { length: 20 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }).notNull(),
  address: text('address').notNull(),
  logoUrl: text('logo_url'),
  contractNumber: varchar('contract_number', { length: 100 }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const branches = pgTable('branches', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  merchantId: bigint('merchant_id', { mode: 'bigint' })
    .notNull()
    .references(() => merchants.id),
  name: varchar('name', { length: 200 }).notNull(),
  address: text('address').notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  merchantId: bigint('merchant_id', { mode: 'bigint' })
    .notNull()
    .references(() => merchants.id),
  name: varchar('name', { length: 200 }).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  merchantId: bigint('merchant_id', { mode: 'bigint' })
    .notNull()
    .references(() => merchants.id),
  categoryId: bigint('category_id', { mode: 'bigint' })
    .notNull()
    .references(() => categories.id),
  name: varchar('name', { length: 200 }).notNull(),
  tanNarxi: numeric('tan_narxi', { precision: 15, scale: 2 }).notNull(),
  mxikCode: varchar('mxik_code', { length: 50 }),
  packageCode: integer('package_code'),
  packageName: varchar('package_name', { length: 200 }),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const mxikCache = pgTable('mxik_cache', {
  mxikCode: varchar('mxik_code', { length: 50 }).primaryKey(),
  mxikName: text('mxik_name'),
  label: integer('label'),
  brandName: varchar('brand_name', { length: 200 }),
  groupName: text('group_name'),
  className: text('class_name'),
  packages: jsonb('packages'),
  rawResponse: jsonb('raw_response'),
  cachedAt: timestamp('cached_at', { withTimezone: true }).defaultNow().notNull(),
});

export const tariffs = pgTable('tariffs', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  termMonths: integer('term_months').notNull(),
  markupPercent: numeric('markup_percent', { precision: 5, scale: 2 }).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const merchantTariffs = pgTable(
  'merchant_tariffs',
  {
    merchantId: bigint('merchant_id', { mode: 'bigint' })
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    tariffId: bigint('tariff_id', { mode: 'bigint' })
      .notNull()
      .references(() => tariffs.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.merchantId, t.tariffId] })],
);

export const merchantDocuments = pgTable('merchant_documents', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  merchantId: bigint('merchant_id', { mode: 'bigint' })
    .notNull()
    .references(() => merchants.id),
  fileUrl: text('file_url').notNull(),
  documentType: varchar('document_type', { length: 50 }).notNull(),
  uploadedByAdminId: bigint('uploaded_by_admin_id', { mode: 'bigint' }).references(
    () => adminUsers.id,
  ),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
});

export const merchantUsers = pgTable('merchant_users', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 500 }).notNull(),
  fullName: varchar('full_name', { length: 200 }).notNull(),
  merchantId: bigint('merchant_id', { mode: 'bigint' })
    .notNull()
    .references(() => merchants.id),
  branchId: bigint('branch_id', { mode: 'bigint' })
    .notNull()
    .references(() => branches.id),
  roles: text('roles').array().notNull(),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const blacklist = pgTable(
  'blacklist',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    type: varchar('type', { length: 10 }).notNull(), // 'pinfl' | 'inn'
    value: varchar('value', { length: 20 }).notNull(),
    reason: text('reason'),
    addedByAdminId: bigint('added_by_admin_id', { mode: 'bigint' })
      .notNull()
      .references(() => adminUsers.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.type, t.value)],
);

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
});
