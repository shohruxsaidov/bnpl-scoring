import { date, integer, jsonb, numeric, pgTable, serial, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { merchants } from './merchants';
import { branches } from './branches';
import { merchantUsers } from './merchant-users';
import { clients } from './clients';
import { tariffs } from './tariffs';
import { dealSessions } from './deal-sessions';

// ---------------------------------------------------------------------------
// deals
// A Deal is created at the Верификация step of the Wizard, built from the
// Deal Session's step data (snapshot prices, tariff params, scoring, KATM).
// Only real signed deals live here — in-progress/abandoned runs are
// deal_sessions rows. See ADR-0024.
// ---------------------------------------------------------------------------
export const deals = pgTable('deals', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: integer('merchant_id')
    .notNull()
    .references(() => merchants.id),
  branchId: integer('branch_id')
    .notNull()
    .references(() => branches.id),
  agentId: integer('agent_id')
    .notNull()
    .references(() => merchantUsers.id),
  clientId: integer('client_id').references(() => clients.id),
  tariffId: integer('tariff_id').references(() => tariffs.id),
  // The Wizard run that produced this Deal (null for deals predating ADR-0024)
  dealSessionId: uuid('deal_session_id').references(() => dealSessions.id),
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
  /** Sum of dealItems.price × quantity in tiyin */
  amount: integer('amount'),
  /** amount × (1 + markupPercent / 100), tiyin */
  totalPayable: integer('total_payable'),
  /** Copied from tariffs.term_months at creation time */
  termMonths: integer('term_months'),
  // Scoring result — copied from scoring_histories at deal activation
  scoreSum: numeric('score_sum', { precision: 10, scale: 2 }),
  scoringDecision: varchar('scoring_decision', { length: 20 }),
  // Avansoviy to'lov — recorded at deal creation when the client paid a gap amount
  // upfront so the installment schedule covers only (totalPayable - prepaymentAmount).
  // Null means no prepayment was made. ADR-0026.
  prepaymentAmount: integer('prepayment_amount'),
  // Kontrakt language selected at Wizard verification step
  lang: varchar('lang', { length: 5 }).notNull().default('ru'),
  // Human-readable sequential identifier, formatted as CN-0000001 at the app layer
  dealNumber: serial('deal_number').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
