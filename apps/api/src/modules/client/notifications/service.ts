import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@db';
import { notifications, type NotificationType } from '@db/notifications';
import type { SupportedLang } from '../../../i18n/index';
import { enqueueNotificationPush } from './push';
import { renderNotificationText } from './render';

export interface NotifyInput {
  userId: number;
  type: NotificationType;
  data?: Record<string, unknown>;
  /** Idempotency key for the source domain event, e.g. 'scoring_result:<id>'. */
  dedupeKey?: string;
  /** Authoring admin, for `custom` notifications. Null for system-generated types. */
  sentByAdminId?: number;
}

/**
 * Create an inbox notification and (best-effort) enqueue its push.
 *
 * The insert is idempotent on `dedupeKey`: a retrying caller (e.g. the KATM poll
 * job re-running) never creates a second row, and the push is enqueued ONLY when
 * a row was actually inserted — so it never double-pushes. The inbox row is the
 * durable source of truth; the push is a mirror. By contract this never throws:
 * a notification failure must not fail the scoring pipeline that triggered it.
 *
 * Returns the new notification id, or null when the insert was a dedupe hit (or
 * failed). Callers that must report an outcome to a human — the admin send-push
 * route — read it; the scoring pipeline ignores it.
 */
export async function notify(input: NotifyInput): Promise<string | null> {
  try {
    const [inserted] = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        data: input.data ?? {},
        dedupeKey: input.dedupeKey ?? null,
        sentByAdminId: input.sentByAdminId ?? null,
      })
      .onConflictDoNothing({ target: notifications.dedupeKey })
      .returning({ id: notifications.id });

    // Conflict (dedupe hit) → no inserted row → no push. Fresh insert → push.
    if (!inserted) return null;
    await enqueueNotificationPush({ notificationId: inserted.id, userId: input.userId });
    return inserted.id;
  } catch (err) {
    console.error('[notifications] notify failed', err);
    return null;
  }
}

/**
 * Row → inbox item, with the text rendered server-side in the caller's language
 * (see ./render). `type` and `data` stay on the wire: they are machine-readable
 * routing, not presentation — the app switches on `type` for the icon and reads
 * `data.dealSessionId` to open the signing flow, exactly as the push does.
 */
export function toNotificationDto(
  row: typeof notifications.$inferSelect,
  lang: SupportedLang,
  warn?: (reason: string) => void,
) {
  const data = (row.data ?? {}) as Record<string, unknown>;
  const { title, body } = renderNotificationText(row.type, lang, data, warn);
  return {
    id: row.id,
    type: row.type,
    data,
    title,
    body,
    readAt: row.readAt ? row.readAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listNotifications(userId: number, limit: number, offset: number) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countUnread(userId: number): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

/**
 * Mark one notification read (idempotent). Returns false only when the row does
 * not exist or is not owned by `userId` — an already-read row returns true and
 * keeps its original readAt (coalesce).
 */
export async function markRead(userId: number, id: string): Promise<boolean> {
  const rows = await db
    .update(notifications)
    .set({ readAt: sql`coalesce(${notifications.readAt}, now())` })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning({ id: notifications.id });
  return rows.length > 0;
}

export async function markAllRead(userId: number): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
