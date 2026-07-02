import { integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { adminUsers } from './admin-users';

// ---------------------------------------------------------------------------
// offer_rules — one logical, versioned document per `type` (only 'registration'
// for now). Latest version wins: the current document for a type is the row
// with the highest `version`. Bodies are Markdown. Versions are assigned in-app
// as MAX(version)+1 per type; edits go live on insert (no draft/staging flag).
// Accepted by clients at registration; see user_offer_rule_acceptances.
// ---------------------------------------------------------------------------
export const offerRules = pgTable(
  'offer_rules',
  {
    id: serial('id').primaryKey(),
    type: varchar('type', { length: 50 }).notNull(),
    version: integer('version').notNull(),
    titleUz: text('title_uz').notNull(),
    titleRu: text('title_ru').notNull(),
    bodyUz: text('body_uz').notNull(),
    bodyRu: text('body_ru').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: integer('created_by').references(() => adminUsers.id),
  },
  (t) => [uniqueIndex('offer_rules_type_version_idx').on(t.type, t.version)],
);
