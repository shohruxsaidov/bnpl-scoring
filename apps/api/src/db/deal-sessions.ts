import { integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { merchants } from './merchants';
import { branches } from './branches';
import { merchantUsers } from './merchant-users';
import { users } from './users';

// ---------------------------------------------------------------------------
// deal_sessions
// One row per Wizard run, created the moment an Agent opens the Wizard
// (before a Client is identified). The mutable head of the run: current_step
// and step_data are overwritten as steps are saved. The run's bureau claim is
// identified by katm_claim_id
// (shared sequence — ADR-0025; the UUID does not fit KATM's pClaimId String(20)).
// At most one 'active' session per Agent — starting a new run abandons the
// previous one. See ADR-0024.
// ---------------------------------------------------------------------------
export const dealSessions = pgTable('deal_sessions', {
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
  // Set once the Клиент step is saved
  userId: integer('user_id').references(() => users.id),
  // The step the Agent is currently on: 'client' | 'card' | 'tariff' | 'products' | 'payment' | 'verification'
  currentStep: varchar('current_step', { length: 20 }).notNull().default('client'),
  // 'active' | 'completed' | 'abandoned'
  status: varchar('status', { length: 10 }).notNull().default('active'),
  // KATM Claim ID (ADR-0025) — drawn from the shared katm_claim_seq when the
  // bureau claim is registered
  katmClaimId: varchar('katm_claim_id', { length: 20 }),
  // Mutable resume snapshot, keyed by step ('client', 'card', …) plus
  // server-stamped 'katm' and 'scoring' blocks. IDs + non-reconstructable
  // snapshots only — no User PII (the users row is the PII home).
  stepData: jsonb('step_data').notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
