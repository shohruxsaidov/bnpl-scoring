import { sql } from 'drizzle-orm';
import { boolean, pgTable, serial, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

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
