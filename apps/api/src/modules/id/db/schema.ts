import { sql } from 'drizzle-orm';
import {
  AnyPgColumn,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

// RBAC roles. Custom, global templates managed from the admin platform.
// `key` is a stable slug (e.g. 'agent', 'superadmin'); seeded system roles rely on it.
export const roles = pgTable(
  'roles',
  {
    id: serial('id').primaryKey(),
    key: varchar('key', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    platform: varchar('platform', { length: 10 }).notNull(), // 'merchant' | 'admin'
    isSuperAdmin: boolean('is_superadmin').notNull().default(false),
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
    roleId: integer('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    feature: varchar('feature', { length: 50 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.feature] })],
);

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  pinfl: varchar('pinfl', { length: 14 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  middleName: varchar('middle_name', { length: 100 }),
  birthDate: date('birth_date').notNull(),
  gender: varchar('gender', { length: 10 }).notNull(),
  nationality: varchar('nationality', { length: 100 }).notNull(),
  passportSerial: varchar('passport_serial', { length: 2 }),
  passportNumber: varchar('passport_number', { length: 7 }),
  photoUrl: text('photo_url'),
  myidVerifiedAt: timestamp('myid_verified_at', { withTimezone: true }).notNull(),
  // KATM claim registration fields (ADR-0025) — sourced from MyID, with
  // manual entry as fallback for rows created before these were captured.
  address: varchar('address', { length: 100 }),
  katmRegionCode: varchar('katm_region_code', { length: 3 }), // dict 016
  katmDistrictCode: varchar('katm_district_code', { length: 3 }), // dict 052
  docType: integer('doc_type'), // 0 — ID card, 6 — biometric passport
  // KATM-SIR — the bureau's subject identifier, returned at claim registration
  katmSir: varchar('katm_sir', { length: 20 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const clientSessions = pgTable('client_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: serial('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  sessionTokenHash: varchar('session_token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

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
    id: serial('id').primaryKey(),
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
    // KATM claim registration fields (ADR-0025) — sourced from MyID, with
    // Agent manual entry as fallback for rows created before these were captured.
    address: varchar('address', { length: 100 }),
    districtCode: varchar('district_code', { length: 3 }), // dict 052
    regionCode: varchar('region_code', { length: 3 }), // dict 016
    docType: integer('doc_type'), // 0 — ID card, 6 — biometric passport
    // KATM-SIR — the bureau's subject identifier, returned at claim registration
    katmSir: varchar('katm_sir', { length: 20 }),
    merchantId: integer('merchant_id').notNull(),
    branchId: integer('branch_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.pinfl, t.merchantId)],
);

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

export const adminSessions = pgTable('admin_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  adminUserId: integer('admin_user_id')
    .notNull()
    .references(() => adminUsers.id, { onDelete: 'cascade' }),
  sessionTokenHash: varchar('session_token_hash', { length: 255 }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
});

// ---------------------------------------------------------------------------
// regions
// Two-level geographic hierarchy: Region (oblast, upperId IS NULL) and
// District (rayon, upperId → parent Region). Seeded from references/regions.json.
// Uses external IDs from finsum.uz — stable integers that map to the source system.
// ---------------------------------------------------------------------------
export const regions = pgTable('regions', {
  id: integer('id').primaryKey(),
  upperId: integer('upper_id').references((): AnyPgColumn => regions.id),
  nameRu: varchar('name_ru', { length: 200 }).notNull(),
  nameUz: varchar('name_uz', { length: 200 }).notNull(),
  nameUzc: varchar('name_uzc', { length: 200 }).notNull(),
});

// merchant_id and branch_id reference merchants/branches tables not yet built.
export const merchants = pgTable('merchants', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  legalName: varchar('legal_name', { length: 200 }).notNull(),
  inn: varchar('inn', { length: 20 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }).notNull(),
  address: text('address').notNull(),
  logoUrl: text('logo_url'),
  contractNumber: varchar('contract_number', { length: 100 }),
  mfo: varchar('mfo', { length: 5 }),
  accountNumber: varchar('account_number', { length: 20 }),
  bankName: varchar('bank_name', { length: 200 }),
  regionId: integer('region_id').references(() => regions.id),
  // ADR-0023: optional Scoring Model assignment; null = the Global Model.
  scoringModelId: integer('scoring_model_id').references(() => scoringModels.id),
  active: boolean('active').notNull().default(true),
  kybStatus: varchar('kyb_status', { length: 20 }).notNull().default('verified'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const bankMfoCache = pgTable('bank_mfo_cache', {
  mfo: varchar('mfo', { length: 5 }).primaryKey(),
  bankName: text('bank_name').notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).defaultNow().notNull(),
});

export const branches = pgTable('branches', {
  id: serial('id').primaryKey(),
  merchantId: integer('merchant_id')
    .notNull()
    .references(() => merchants.id),
  name: varchar('name', { length: 200 }).notNull(),
  address: text('address').notNull(),
  phone: varchar('phone', { length: 20 }).notNull(),
  regionId: integer('region_id').references(() => regions.id),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const merchantCategories = pgTable(
  'merchant_categories',
  {
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    merchantId: integer('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.categoryId, t.merchantId] })],
);

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  merchantId: integer('merchant_id')
    .notNull()
    .references(() => merchants.id),
  categoryId: integer('category_id')
    .notNull()
    .references(() => categories.id),
  name: varchar('name', { length: 200 }).notNull(),
  price: numeric('price', { precision: 15, scale: 2 }).notNull(),
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

// ADR-0023: named family of revisions. Exactly one model is the Global Model
// at all times (partial unique index); it serves every scoring run whose
// Merchant has no assigned model, and all self-service runs.
export const scoringModels = pgTable(
  'scoring_models',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 200 }).notNull(),
    isGlobal: boolean('is_global').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('scoring_models_single_global_idx')
      .on(t.isGlobal)
      .where(sql`${t.isGlobal}`),
  ],
);

// scoringModelId is nullable only so the column can be added to a populated
// table; the backfill script attaches every orphan revision to the Global
// Model, and all write paths set it.
export const scoringModelRevisions = pgTable('scoring_model_revisions', {
  id: serial('id').primaryKey(),
  scoringModelId: integer('scoring_model_id').references(() => scoringModels.id),
  name: text('name').notNull(),
  version: varchar('version', { length: 50 }).notNull(),
  params: jsonb('params').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: integer('created_by').references(() => adminUsers.id),
});

export const tariffs = pgTable('tariffs', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  termMonths: integer('term_months').notNull(),
  markupPercent: numeric('markup_percent', { precision: 5, scale: 2 }).notNull(),
  // Credit Range (tiyin); null bound = unbounded on that side
  minAmount: integer('min_amount'),
  maxAmount: integer('max_amount'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const merchantTariffs = pgTable(
  'merchant_tariffs',
  {
    merchantId: integer('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    tariffId: integer('tariff_id')
      .notNull()
      .references(() => tariffs.id, { onDelete: 'cascade' }),
    addedAt: timestamp('added_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.merchantId, t.tariffId] })],
);

export const scoringTestCases = pgTable('scoring_test_cases', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  inputs: jsonb('inputs').notNull(),
  expectedOutcome: varchar('expected_outcome', { length: 20 }).notNull(), // 'approved' | 'partial' | 'denied' | 'rejected'
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const scoringTestRuns = pgTable('scoring_test_runs', {
  id: serial('id').primaryKey(),
  modelRevisionId: integer('model_revision_id')
    .notNull()
    .references(() => scoringModelRevisions.id),
  ranAt: timestamp('ran_at', { withTimezone: true }).defaultNow().notNull(),
  passCount: integer('pass_count').notNull(),
  failCount: integer('fail_count').notNull(),
  results: jsonb('results').notNull(), // array of { testCaseId, name, expectedOutcome, actualOutcome, totalScore, coefficient, breakdown, pass }
});

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

export const blacklist = pgTable(
  'blacklist',
  {
    id: serial('id').primaryKey(),
    type: varchar('type', { length: 10 }).notNull(), // 'pinfl' | 'inn'
    value: varchar('value', { length: 20 }).notNull(),
    reason: text('reason'),
    addedByAdminId: integer('added_by_admin_id')
      .notNull()
      .references(() => adminUsers.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.type, t.value)],
);

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
