import {
  bigint,
  bigserial,
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { clients, merchantUsers, merchants, branches, tariffs, products, adminUsers } from '../../id/db/schema'
import { files } from '../../../lib/file-storage/schema'

// ---------------------------------------------------------------------------
// deals
// A Deal is created (status = 'draft') when an Agent opens the Wizard.
// Its UUID is sent as claim_id on all KATM requests made during that run.
// Abandoned Wizard runs remain as 'draft' rows — never surfaced to users.
// ---------------------------------------------------------------------------
export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: bigint('merchant_id', { mode: 'bigint' }).notNull().references(() => merchants.id),
  branchId: bigint('branch_id', { mode: 'bigint' }).notNull().references(() => branches.id),
  agentId: bigint('agent_id', { mode: 'bigint' }).notNull().references(() => merchantUsers.id),
  clientId: bigint('client_id', { mode: 'bigint' }).references(() => clients.id),
  tariffId: bigint('tariff_id', { mode: 'bigint' }).references(() => tariffs.id),
  // KATM consent — collected at start of Wizard
  consentId: varchar('consent_id', { length: 100 }),
  consentDate: date('consent_date'),
  // KATM response audit fields (previously on wizard_sessions)
  demandId: varchar('demand_id', { length: 16 }),
  infoscoreRaw: jsonb('infoscore_raw'),
  paymentDay: integer('payment_day'),
  // 'draft' | 'scoring' | 'approved' | 'declined' | 'active' | 'closed' | 'overdue'
  status: varchar('status', { length: 20 }).notNull().default('draft'),
  // Denormalized financials — stored at creation so list queries need no heavy joins
  /** Sum of dealItems.tanNarxi × quantity in tiyin */
  amount: bigint('amount', { mode: 'bigint' }),
  /** amount × (1 + markupPercent / 100), tiyin */
  totalPayable: bigint('total_payable', { mode: 'bigint' }),
  /** Copied from tariffs.term_months at creation time */
  termMonths: integer('term_months'),
  // Scoring result — copied from scoring_histories at deal activation
  scoreSum: numeric('score_sum', { precision: 10, scale: 2 }),
  scoringDecision: varchar('scoring_decision', { length: 20 }),
  // Kontrakt language selected at Wizard verification step
  lang: varchar('lang', { length: 5 }).notNull().default('ru'),
  // Human-readable sequential identifier, formatted as CN-0000001 at the app layer
  dealNumber: bigserial('deal_number', { mode: 'bigint' }).notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// scoring_histories
// One row per scoring run. No FK constraints — client/deal data is snapshotted
// at scoring time so records remain accurate even if linked rows change.
// ---------------------------------------------------------------------------
export const scoringHistories = pgTable('scoring_histories', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  // Link to clients row (nullable — self-service scoring has no merchant-scoped client)
  clientId: bigint('client_id', { mode: 'bigint' }).references(() => clients.id),
  // Client snapshot at scoring time
  firstName: varchar('first_name', { length: 100 }),
  lastName: varchar('last_name', { length: 100 }),
  middleName: varchar('middle_name', { length: 100 }),
  passportNumber: varchar('passport_number', { length: 10 }),
  passportSeries: varchar('passport_series', { length: 5 }),
  pinfl: varchar('pinfl', { length: 14 }),
  phoneNumber: varchar('phone_number', { length: 20 }),
  // Full per-criterion breakdown: { income, workPeriod, creditHistory, overdues, liabilities, demographics, cardScore }
  criteriaScores: jsonb('criteria_scores'),
  scoreSum: numeric('score_sum', { precision: 10, scale: 2 }),
  // Coefficient from the global coefficient table: 0 = denied, 0.8 = partial, 1.0 = full
  coefficient: numeric('coefficient', { precision: 5, scale: 4 }),
  // 'approved' | 'declined' | 'manual_review'
  decision: varchar('decision', { length: 20 }).notNull(),
  platformCreditLimit: bigint('platform_credit_limit', { mode: 'bigint' }).notNull(),
  scoredAt: timestamp('scored_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// deal_items
// Normalized Basket — one row per Product line in the Deal.
// Snapshot fields (product_name, tan_narxi, mxik_code, package_*) are
// denormalized at Deal creation time so Product edits don't alter past Deals.
// ---------------------------------------------------------------------------
export const dealItems = pgTable('deal_items', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  // nullable — product may be deleted after Deal creation; snapshot fields remain
  productId: bigint('product_id', { mode: 'bigint' }).references(() => products.id),
  // snapshot at time of Deal creation
  productName: varchar('product_name', { length: 200 }).notNull(),
  tanNarxi: numeric('tan_narxi', { precision: 15, scale: 2 }).notNull(),
  mxikCode: varchar('mxik_code', { length: 50 }),
  packageCode: integer('package_code'),
  packageName: varchar('package_name', { length: 200 }),
  quantity: integer('quantity').notNull().default(1),
})

// ---------------------------------------------------------------------------
// manual_payments
// A single Platform Admin payment event that settles one or more instalments
// FIFO by dueDate. Amount stored in tiyin.
// ---------------------------------------------------------------------------
export const manualPayments = pgTable('manual_payments', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  adminUserId: bigint('admin_user_id', { mode: 'bigint' }).references(() => adminUsers.id),
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  paymentType: text('payment_type').notNull().default('mib'),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// deal_payment_schedules
// One row per instalment. Used by the Collection Board / Aging Bucket queries.
// Aging: dueDate <= today AND paid = false → determines Days Overdue.
// manualPaymentId is set when the row was settled by a Manual Payment event.
// ---------------------------------------------------------------------------
export const dealPaymentSchedules = pgTable('deal_payment_schedules', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  index: integer('index').notNull(),
  dueDate: date('due_date').notNull(),
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  /** Cumulative amount paid so far (tiyin). Fully paid when paidAmount >= amount. */
  paidAmount: bigint('paid_amount', { mode: 'bigint' }).notNull().$defaultFn(() => 0n),
  paid: boolean('paid').notNull().default(false),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  manualPaymentId: bigint('manual_payment_id', { mode: 'bigint' }).references(() => manualPayments.id),
})

// ---------------------------------------------------------------------------
// deal_comments
// Admin-authored notes on a deal. Append-only, not editable or deletable.
// ---------------------------------------------------------------------------
export const dealComments = pgTable('deal_comments', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
  adminUserId: bigint('admin_user_id', { mode: 'bigint' }).notNull().references(() => adminUsers.id),
  text: text('text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// buyouts
// One row per Deal, created atomically with the Deal when a Kontrakt is signed.
// Records the obligation Finsum Nasiya owes the Merchant (tan narxi sum).
// Processed manually by the Platform Admin — status flips pending → paid.
// ---------------------------------------------------------------------------
export const buyouts = pgTable('buyouts', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  dealId: uuid('deal_id').notNull().references(() => deals.id),
  merchantId: bigint('merchant_id', { mode: 'bigint' }).notNull().references(() => merchants.id),
  branchId: bigint('branch_id', { mode: 'bigint' }).notNull().references(() => branches.id),
  amount: bigint('amount', { mode: 'bigint' }).notNull(),
  // 'pending' | 'paid'
  status: varchar('status', { length: 10 }).notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// deal_documents
// One row per document type per Deal. Currently only 'contract' (PDF).
// Unique constraint ensures one Contract per Deal; upsert replaces on regeneration.
// ---------------------------------------------------------------------------
export const dealDocuments = pgTable(
  'deal_documents',
  {
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    dealId: uuid('deal_id').notNull().references(() => deals.id, { onDelete: 'cascade' }),
    fileId: bigint('file_id', { mode: 'bigint' }).notNull().references(() => files.id),
    documentType: varchar('document_type', { length: 50 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.dealId, t.documentType)],
)
