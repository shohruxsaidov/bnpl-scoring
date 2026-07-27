import { sql } from 'drizzle-orm';
import {
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { merchants } from './merchants';
import { branches } from './branches';
import { merchantUsers } from './merchant-users';
import { tariffs } from './tariffs';
import { dealSessions } from './deal-sessions';
import { users } from './users';

// ---------------------------------------------------------------------------
// deals
// A Deal is created at the Верификация step of the Wizard, built from the
// Deal Session's step data (snapshot prices, tariff params, scoring, KATM).
// Only real signed deals live here — in-progress/abandoned runs are
// deal_sessions rows. See ADR-0024.
// ---------------------------------------------------------------------------
export const deals = pgTable(
  'deals',
  {
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
    userId: integer('user_id').references(() => users.id),
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
    /** Sum of dealItems.price × quantity, in som */
    amount: numeric('amount', { precision: 15, scale: 2, mode: 'number' }),
    /** amount × (1 + markupPercent / 100), in som */
    totalPayable: numeric('total_payable', { precision: 15, scale: 2, mode: 'number' }),
    /** Copied from tariffs.term_months at creation time */
    termMonths: integer('term_months'),
    // Scoring result — copied from scoring_histories at deal activation
    scoreSum: numeric('score_sum', { precision: 10, scale: 2 }),
    scoringDecision: varchar('scoring_decision', { length: 20 }),
    // Avansoviy to'lov — recorded at deal creation when the client paid a gap amount
    // upfront so the installment schedule covers only (totalPayable - prepaymentAmount).
    // Null means no prepayment was made. ADR-0026. In som.
    prepaymentAmount: numeric('prepayment_amount', { precision: 15, scale: 2, mode: 'number' }),
    // Kontrakt language selected at Wizard verification step
    lang: varchar('lang', { length: 5 }).notNull().default('ru'),
    // Human-readable sequential identifier — plain integer starting at 1000
    dealNumber: integer('deal_number')
      .notNull()
      .unique()
      .generatedAlwaysAsIdentity({ startWith: 1000 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // One Active Deal — a client carries at most one open deal, platform-wide.
    // The app rejects earlier and with a reason (modules/deals/blocking.ts); this
    // index is what wins the race two merchants can otherwise both pass, since
    // neither transaction's SELECT can see the other's uncommitted insert.
    // Legacy deals carry a NULL user_id and Postgres treats NULLs as distinct,
    // so they never collide here.
    uniqueIndex('deals_user_active_idx')
      .on(t.userId)
      .where(sql`status in ('active', 'overdue')`),
    // One Deal per Wizard run. The Deal is now built by the server the instant the
    // client confirms the акцепт, so two confirmations of the same run — a retried
    // request, a double-tap, the client's phone and the agent's tablet racing — are
    // ordinary traffic rather than an abuse case. The read-then-create check in
    // autoCreateDealAfterSigning rejects almost all of them; this index is what
    // holds when both reads miss. Unlike the index above this is not a business
    // rule the agent can violate — it is the identity of the run.
    // Legacy deals carry a NULL deal_session_id and Postgres treats NULLs as
    // distinct, so they never collide here.
    uniqueIndex('deals_deal_session_idx').on(t.dealSessionId),
  ],
);

export type DealInferSelect = typeof deals.$inferSelect;
