import { date, integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  phone: varchar('phone', { length: 20 }).notNull().unique(),
  pinfl: varchar('pinfl', { length: 14 }).notNull().unique(),
  firstName: varchar('first_name', { length: 100 }).notNull(),
  lastName: varchar('last_name', { length: 100 }).notNull(),
  middleName: varchar('middle_name', { length: 100 }),
  birthDate: date('birth_date').notNull(),
  gender: integer('gender').notNull(), // for male = 1; for female = 2;
  nationality: varchar('nationality', { length: 100 }).notNull(),
  passportSeries: varchar('passport_series', { length: 2 }),
  passportNumber: varchar('passport_number', { length: 7 }),
  photoUrl: text('photo_url'),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  address: varchar('address', { length: 100 }),
  regionCode: varchar('region_code', { length: 3 }), // dict 016
  districtCode: varchar('district_code', { length: 3 }), // dict 052
  docType: integer('doc_type'), // 0 — ID card, 6 — biometric passport
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  hashPassword: varchar('hash_password'),
});
