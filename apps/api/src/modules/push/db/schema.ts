import { bigint, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorType: varchar('actor_type', { length: 20 }).notNull().default('client').$type<'client' | 'employee'>(),
  userId: bigint('user_id', { mode: 'bigint' }).notNull(),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})
