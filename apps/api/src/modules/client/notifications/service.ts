import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@db';
import { notifications, type NotificationType } from '@db/notifications';
import { enqueueNotificationPush } from './push';

export interface NotifyInput {
  userId: number;
  type: NotificationType;
  data?: Record<string, unknown>;
  /** Idempotency key for the source domain event, e.g. 'scoring_result:<id>'. */
  dedupeKey?: string;
}

/**
 * Create an inbox notification and (best-effort) enqueue its push.
 *
 * The insert is idempotent on `dedupeKey`: a retrying caller (e.g. the KATM poll
 * job re-running) never creates a second row, and the push is enqueued ONLY when
 * a row was actually inserted — so it never double-pushes. The inbox row is the
 * durable source of truth; the push is a mirror. By contract this never throws:
 * a notification failure must not fail the scoring pipeline that triggered it.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const [inserted] = await db
      .insert(notifications)
      .values({
        userId: input.userId,
        type: input.type,
        data: input.data ?? {},
        dedupeKey: input.dedupeKey ?? null,
      })
      .onConflictDoNothing({ target: notifications.dedupeKey })
      .returning({ id: notifications.id });

    // Conflict (dedupe hit) → no inserted row → no push. Fresh insert → push.
    if (!inserted) return;
    await enqueueNotificationPush({ notificationId: inserted.id, userId: input.userId });
  } catch (err) {
    console.error('[notifications] notify failed', err);
  }
}

export function toNotificationDto(row: typeof notifications.$inferSelect) {
  return {
    id: row.id,
    type: row.type,
    data: (row.data ?? {}) as Record<string, unknown>,
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
