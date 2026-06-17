import { boolean, integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { regions } from './regions';
import { scoringModels } from './scoring-models';

export const merchants = pgTable('merchants', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  legalName: varchar('legal_name', { length: 200 }).notNull(),
  inn: varchar('inn', { length: 20 }).notNull().unique(),
  phone: varchar('phone', { length: 20 }).notNull(),
  address: text('address').notNull(),
  logoUrl: text('logo_url'),
  contractNumber: varchar('contract_number', { length: 100 }),
  mfo: varchar('mfo', { length: 5 }),
  accountNumber: varchar('account_number', { length: 20 }),
  bankName: varchar('bank_name', { length: 200 }),
  regionId: integer('region_id').references(() => regions.id),
  // ADR-0023: optional Scoring Model assignment; null = the Global Model.
  scoringModelId: integer('scoring_model_id').references(() => scoringModels.id),
  active: boolean('active').notNull().default(true),
  kybStatus: varchar('kyb_status', { length: 20 }).notNull().default('verified'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
