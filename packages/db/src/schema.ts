/**
 * Drizzle ORM schema — single source of truth for all tables.
 *
 * Conventions (ADR 0002 multi-tenancy):
 *  - Every table has: id, created_at, updated_at, deleted_at (soft delete).
 *  - Tenant-scoped tables carry tenant_id NOT NULL REFERENCES tenants(id).
 *  - All list queries MUST filter `deleted_at IS NULL` and `tenant_id = $t`.
 */

import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  bigint,
  jsonb,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { isNotNull } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Reusable column groups
// ---------------------------------------------------------------------------

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

const id = () => uuid("id").primaryKey().defaultRandom();

// ---------------------------------------------------------------------------
// Tenancy
// ---------------------------------------------------------------------------

export const tenants = pgTable("tenants", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

const tenantId = () =>
  uuid("tenant_id")
    .notNull()
    .references(() => tenants.id);

// ---------------------------------------------------------------------------
// Identity: employees, roles
// ---------------------------------------------------------------------------

export const roles = pgTable("roles", {
  id: id(),
  tenantId: tenantId(),
  name: text("name").notNull(),
  description: text("description"),
  ...timestamps,
});

export const employees = pgTable("employees", {
  id: id(),
  tenantId: tenantId(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const employeeRoles = pgTable(
  "employee_roles",
  {
    id: id(),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id),
    ...timestamps,
  },
  (t) => [unique("employee_role_uq").on(t.employeeId, t.roleId)],
);

// ---------------------------------------------------------------------------
// Clients & cards
// ---------------------------------------------------------------------------

export const clients = pgTable(
  "clients",
  {
    id: id(),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    passportSerial: text("passport_serial"),
    pinfl: text("pinfl"), // set after MyID verification; unique platform-wide when present
    birthDate: text("birth_date"),
    legacyId: text("legacy_id"), // transitional: ident.identificators.id from legacy system
    ...timestamps,
  },
  (t) => [
    uniqueIndex("clients_pinfl_uq").on(t.pinfl).where(isNotNull(t.pinfl)),
  ],
);

export const merchantClients = pgTable(
  "merchant_clients",
  {
    id: id(),
    tenantId: tenantId(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    ...timestamps,
  },
  (t) => [unique("merchant_clients_tenant_client_uq").on(t.tenantId, t.clientId)],
);

export const clientOtpCodes = pgTable("client_otp_codes", {
  id: id(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const clientCards = pgTable("client_cards", {
  id: id(),
  tenantId: tenantId(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  maskedPan: text("masked_pan").notNull(),
  token: text("token").notNull(),
  expiry: text("expiry").notNull(),
  primary: boolean("primary").notNull().default(false),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const categories = pgTable("categories", {
  id: id(),
  tenantId: tenantId(),
  name: text("name").notNull(),
  parentId: uuid("parent_id"),
  ...timestamps,
});

export const products = pgTable("products", {
  id: id(),
  tenantId: tenantId(),
  categoryId: uuid("category_id").references(() => categories.id),
  name: text("name").notNull(),
  sku: text("sku").notNull(),
  price: bigint("price", { mode: "number" }).notNull(),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const tariffs = pgTable("tariffs", {
  id: id(),
  tenantId: tenantId(),
  name: text("name").notNull(),
  termMonths: integer("term_months").notNull(),
  markupPercent: numeric("markup_percent", { precision: 6, scale: 2 })
    .notNull()
    .default("0"),
  creditMin: bigint("credit_min", { mode: "number" }).notNull().default(0),
  creditMax: bigint("credit_max", { mode: "number" }).notNull().default(0),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export const scoringModels = pgTable("scoring_models", {
  id: id(),
  tenantId: tenantId(),
  name: text("name").notNull(),
  version: integer("version").notNull().default(1),
  active: boolean("active").notNull().default(true),
  ...timestamps,
});

export const scoringCriteria = pgTable("scoring_criteria", {
  id: id(),
  tenantId: tenantId(),
  modelId: uuid("model_id")
    .notNull()
    .references(() => scoringModels.id),
  code: text("code").notNull(),
  label: text("label").notNull(),
  weight: numeric("weight", { precision: 6, scale: 3 }).notNull().default("0"),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// Deals
// ---------------------------------------------------------------------------

export const deals = pgTable("deals", {
  id: id(),
  tenantId: tenantId(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => employees.id),
  tariffId: uuid("tariff_id")
    .notNull()
    .references(() => tariffs.id),
  katmConsentId: uuid("katm_consent_id").references(() => katmConsents.id),
  status: text("status").notNull().default("draft"),
  principal: bigint("principal", { mode: "number" }).notNull().default(0),
  totalPayable: bigint("total_payable", { mode: "number" })
    .notNull()
    .default(0),
  ...timestamps,
});

export const dealBaskets = pgTable("deal_baskets", {
  id: id(),
  tenantId: tenantId(),
  dealId: uuid("deal_id")
    .notNull()
    .references(() => deals.id),
  total: bigint("total", { mode: "number" }).notNull().default(0),
  ...timestamps,
});

export const dealBasketItems = pgTable("deal_basket_items", {
  id: id(),
  tenantId: tenantId(),
  basketId: uuid("basket_id")
    .notNull()
    .references(() => dealBaskets.id),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: bigint("unit_price", { mode: "number" }).notNull(),
  ...timestamps,
});

export const installmentSchedules = pgTable("installment_schedules", {
  id: id(),
  tenantId: tenantId(),
  dealId: uuid("deal_id")
    .notNull()
    .references(() => deals.id),
  sequence: integer("sequence").notNull(),
  dueDate: text("due_date").notNull(),
  amount: bigint("amount", { mode: "number" }).notNull(),
  paid: boolean("paid").notNull().default(false),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  ...timestamps,
});

export const dealEvents = pgTable("deal_events", {
  id: id(),
  tenantId: tenantId(),
  dealId: uuid("deal_id")
    .notNull()
    .references(() => deals.id),
  status: text("status").notNull(),
  note: text("note"),
  actorId: uuid("actor_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const payments = pgTable(
  "payments",
  {
    id: id(),
    tenantId: tenantId(),
    dealId: uuid("deal_id")
      .notNull()
      .references(() => deals.id),
    transactionId: text("transaction_id").notNull(),
    amount: bigint("amount", { mode: "number" }).notNull(),
    status: text("status").notNull().default("pending"),
    provider: text("provider").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    ...timestamps,
  },
  // transaction_id is the webhook idempotency key (ADR 0005).
  (t) => [unique("payments_transaction_id_uq").on(t.transactionId)],
);

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export const notifications = pgTable("notifications", {
  id: id(),
  tenantId: tenantId(),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  kind: text("kind").notNull(), // 'overdue' | 'payment' | 'deal'
  title: text("title").notNull(),
  body: text("body").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// Wizard & integrations
// ---------------------------------------------------------------------------

export const wizardSessions = pgTable("wizard_sessions", {
  id: id(),
  tenantId: tenantId(),
  dealId: uuid("deal_id").references(() => deals.id),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => employees.id),
  currentStep: text("current_step").notNull().default("client"),
  steps: jsonb("steps").notNull().default("[]"),
  rawKatmResponse: jsonb("raw_katm_response"),
  katmDemandId: text("katm_demand_id"),
  ...timestamps,
});

export const katmConsents = pgTable(
  "katm_consents",
  {
    id: id(),
    tenantId: tenantId(),
    wizardSessionId: uuid("wizard_session_id")
      .notNull()
      .references(() => wizardSessions.id),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id),
    consentId: text("consent_id").notNull(),
    granted: boolean("granted").notNull().default(false),
    grantedAt: timestamp("granted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [unique("katm_consents_session_uq").on(t.wizardSessionId)],
);

export const plumgateScoringSessions = pgTable("plumgate_scoring_sessions", {
  id: id(),
  tenantId: tenantId(),
  wizardSessionId: uuid("wizard_session_id")
    .notNull()
    .references(() => wizardSessions.id),
  clientId: uuid("client_id")
    .notNull()
    .references(() => clients.id),
  cardId: uuid("card_id").references(() => clientCards.id),
  network: text("network").notNull(), // 'uzcard' | 'humo'
  externalSessionId: text("external_session_id").notNull(),
  status: text("status").notNull().default("pending"), // 'confirmed' | 'skipped' | 'failed'
  scoreValue: numeric("score_value", { precision: 8, scale: 2 }),
  rawResponse: jsonb("raw_response"),
  ...timestamps,
});

export const kontraktDocuments = pgTable("kontrakt_documents", {
  id: id(),
  tenantId: tenantId(),
  dealId: uuid("deal_id")
    .notNull()
    .references(() => deals.id),
  url: text("url").notNull(),
  signed: boolean("signed").notNull().default(false),
  signedAt: timestamp("signed_at", { withTimezone: true }),
  ...timestamps,
});
