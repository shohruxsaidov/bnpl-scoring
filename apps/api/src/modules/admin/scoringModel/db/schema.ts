import { bigint, jsonb, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { adminUsers } from '../../../id/db/schema'

export const scoringModelRevisions = pgTable('scoring_model_revisions', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  version: varchar('version', { length: 50 }).notNull(),
  params: jsonb('params').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: bigint('created_by', { mode: 'bigint' }).references(() => adminUsers.id),
})
