import { date, integer, pgTable, serial, text, timestamp, unique, varchar } from 'drizzle-orm/pg-core';

export const clients = pgTable(
  'clients',
  {
    id: serial('id').primaryKey(),
    phone: varchar('phone', { length: 20 }).notNull(),
    pinfl: varchar('pinfl', { length: 14 }).notNull(),
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),
    middleName: varchar('middle_name', { length: 100 }),
    birthDate: date('birth_date').notNull(),
    gender: varchar('gender', { length: 10 }).notNull(),
    nationality: varchar('nationality', { length: 100 }).notNull(),
    passportSerial: varchar('passport_serial', { length: 5 }),
    passportNumber: varchar('passport_number', { length: 10 }),
    photoUrl: text('photo_url'),
    myidVerifiedAt: timestamp('myid_verified_at', { withTimezone: true }).notNull(),
    // KATM claim registration fields (ADR-0025) — sourced from MyID, with
    // Agent manual entry as fallback for rows created before these were captured.
    address: varchar('address', { length: 100 }),
    districtCode: varchar('district_code', { length: 3 }), // dict 052
    regionCode: varchar('region_code', { length: 3 }), // dict 016
    docType: integer('doc_type'), // 0 — ID card, 6 — biometric passport
    // KATM-SIR — the bureau's subject identifier, returned at claim registration
    katmSir: varchar('katm_sir', { length: 20 }),
    merchantId: integer('merchant_id').notNull(),
    branchId: integer('branch_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.pinfl, t.merchantId)],
);
