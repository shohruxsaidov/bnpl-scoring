import {
  bigint,
  bigserial,
  date,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { users } from '../../id/db/schema'

export const scoringSessions = pgTable('scoring_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: bigint('user_id', { mode: 'bigint' }).notNull().references(() => users.id),
  consentId: varchar('consent_id', { length: 100 }).notNull(),
  consentDate: date('consent_date').notNull(),
  // 'pending' | 'running' | 'completed' | 'failed'
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  scoredAt: timestamp('scored_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const scoringPipelines = pgTable('scoring_pipelines', {
  id: bigserial('id', { mode: 'bigint' }).primaryKey(),
  sessionId: uuid('session_id').notNull().references(() => scoringSessions.id),
  // 'katm' | 'card_scoring'
  type: varchar('type', { length: 20 }).notNull(),
  // 'pending' | 'running' | 'completed' | 'failed'
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  result: jsonb('result'),
  error: text('error'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
})

export const userLimits = pgTable('user_limits', {
  userId: bigint('user_id', { mode: 'bigint' }).primaryKey().references(() => users.id),
  limitAmount: bigint('limit_amount', { mode: 'bigint' }).notNull(),
  sessionId: uuid('session_id').notNull().references(() => scoringSessions.id),
  scoredAt: timestamp('scored_at', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})
