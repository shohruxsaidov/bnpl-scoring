import { boolean, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorType: varchar('actor_type', { length: 20 })
    .notNull()
    .$type<'employee' | 'client' | 'admin'>(),
  actorId: integer('actor_id').notNull(),
  type: varchar('type', { length: 40 }).notNull(),
  params: jsonb('params').notNull().$type<Record<string, string>>().default({}),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
