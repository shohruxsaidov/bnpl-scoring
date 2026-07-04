import { integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './users';

export const userDevices = pgTable('user_devices', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  deviceId: varchar('device_id', { length: 255 }).notNull().unique(),
  fcmToken: text('fcm_token'),
  platform: varchar('platform', { length: 10 }).notNull().$type<'ios' | 'android'>(),
  appVersion: varchar('app_version', { length: 10 }).notNull(),
  // Set when the device completes /setup (full OTP + MyID onboarding). Marks the
  // device as trusted for PIN/biometric login; null means merely known.
  activatedAt: timestamp('activated_at', { withTimezone: true }),
  // Base64 SPKI-DER of the device's ES256 (P-256) biometric public key. The
  // private key never leaves the Secure Enclave / Keystore. Null until the
  // device enrolls biometric via POST /client/auth/register-device; cleared on
  // re-activation (device changes hands) and on DELETE (biometric disabled).
  publicKey: text('public_key'),
  keyRegisteredAt: timestamp('key_registered_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
