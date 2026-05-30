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
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { clients, merchantUsers, merchants, branches, tariffs, products } from '../../id/db/schema'

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
  // Scoring result — copied from client_scorings at deal activation
  scoreSum: numeric('score_sum', { precision: 10, scale: 2 }),
  scoringDecision: varchar('scoring_decision', { length: 20 }),
  // Kontrakt language selected at Wizard verification step
  lang: varchar('lang', { length: 5 }).notNull().default('ru'),
  // MinIO object key for the cached Kontrakt PDF; null until first generation
  pdfUrl: text('pdf_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

// ---------------------------------------------------------------------------
// client_scorings
// One row per scoring run. FK on this side to avoid circular dependency with deals.
// Stores the full criteria breakdown (jsonb) + actionable fields as columns.
// ---------------------------------------------------------------------------
export const clientScorings = pgTable('client_scorings', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  clientId: bigint('client_id', { mode: 'bigint' }).notNull().references(() => clients.id),
  // Nullable: a scoring run is recorded the moment KATM + card scoring completes,
  // before any deal exists. Linked to a deal later if the wizard reaches creation.
  dealId: uuid('deal_id').references(() => deals.id),
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
// deal_payment_schedules
// One row per instalment. Used by the Collection Board / Aging Bucket queries.
// Aging: dueDate <= today AND paid = false → determines Days Overdue.
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
})
