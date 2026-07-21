import { sql } from 'drizzle-orm';
import { index, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { adminUsers } from './admin-users';
import { users } from './users';

// ---------------------------------------------------------------------------
// notifications
// Per-user in-app inbox (Client mobile app). Each row is the durable source of
// truth for one notification; the FCM push (notifications-push queue) is a
// best-effort mirror delivered against it. Content is data-driven: the row
// stores a `type` + `data` params, and the client renders localized text from
// its own i18n bundle (the server renders the push title/body from src/i18n).
//
// v1 types: 'scoring_approved' | 'scoring_rejected' | 'limit_updated'.
// `dedupeKey` makes creation idempotent per source domain event (e.g.
// 'scoring_result:<scoringId>') — notify() inserts on-conflict-do-nothing and
// only enqueues a push when a row was actually inserted, so a retrying job
// never double-pushes.
//
// 'custom' is the one type NOT rendered from the i18n bundle: an admin authors
// the text by hand on the client detail page, and it travels in `data` as
// {titleRu, titleUz, bodyRu, bodyUz}. See renderPush() in ./notifications/push.
//
// 'deal_signing_request' is the one type that is a CALL TO ACTION rather than
// news: a merchant is asking the client, standing at their counter, to sign on
// their own phone. Its push carries a `screen` so tapping it opens the signing
// flow — but the notification is only a nudge. GET /client/deals/to-sign is the
// source of truth, and the app must find the request there with no push at all,
// because FCM drops messages and a dead push would otherwise mean a dead deal.
// ---------------------------------------------------------------------------
export type NotificationType =
  | 'scoring_approved'
  | 'scoring_rejected'
  | 'limit_updated'
  | 'payment_received'
  | 'deal_signing_request'
  | 'custom';

/** Admin-authored text for a `custom` notification, carried in `data`. */
export interface CustomNotificationText {
  titleRu: string;
  titleUz: string;
  bodyRu: string;
  bodyUz: string;
}

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 40 }).notNull().$type<NotificationType>(),
    // Render params (amount, decision, source ids). Localized text is built from
    // type + these, never stored pre-rendered.
    data: jsonb('data').notNull().default({}),
    // One row per source domain event, e.g. 'scoring_result:<scoringId>'. Unique;
    // NULL allowed (Postgres treats NULLs as distinct) for ad-hoc rows.
    dedupeKey: varchar('dedupe_key', { length: 120 }).unique(),
    // The admin who authored a `custom` notification; null for system-generated
    // types. Lives in a column rather than in `data` because toNotificationDto
    // hands `data` verbatim to the client app — an admin id has no business there.
    sentByAdminId: integer('sent_by_admin_id').references(() => adminUsers.id, {
      onDelete: 'set null',
    }),
    // null = unread.
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // Inbox list — newest-first per user.
    index('notifications_user_created_idx').on(t.userId, t.createdAt.desc()),
    // Fast unread count / badge.
    index('notifications_user_unread_idx').on(t.userId).where(sql`${t.readAt} is null`),
  ],
);
