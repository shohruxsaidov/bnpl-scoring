import { boolean, integer, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
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
  // OS model string as the app reports it ('iPhone 14 Pro', 'Samsung SM-S911B'),
  // sent on /setup, /login and the fcm-token upsert. Its only job is to make a
  // row recognisable to its owner in the app's device list — without it two
  // iPhones are both "iOS · 1.0.2" and neither can be told apart, which defeats
  // the one thing that screen exists for. Nullable: old app builds send nothing,
  // and a null must never overwrite a name we already have.
  deviceName: varchar('device_name', { length: 100 }),
  // Client's push preference FOR THIS DEVICE. Enforced in exactly one place —
  // the push worker's device query — so a muted device simply isn't in the token
  // list. It gates the FCM MIRROR only: notify() still writes the inbox row, or a
  // client who muted for a week would come back to a hole in their payment
  // history. Reset to true on re-activation (see activateDevice): a device that
  // changed hands must not inherit the previous owner's mute.
  pushEnabled: boolean('push_enabled').notNull().default(true),
  // UI language the app runs in, sent on the fcm-token upsert. Drives the
  // locale of push title/body (rendered server-side in the push worker, which
  // has no request context). Defaults to 'ru' (matches deals.lang).
  language: varchar('language', { length: 2 }).notNull().default('ru').$type<'uz' | 'ru'>(),
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
