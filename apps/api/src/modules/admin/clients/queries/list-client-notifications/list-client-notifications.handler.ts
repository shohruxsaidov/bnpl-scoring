import { desc, eq } from 'drizzle-orm';
import { db } from '@db';
import { adminUsers } from '@db/admin-users';
import { notifications } from '@db/notifications';

// Everything ever delivered to this client's inbox — the admin-facing mirror of
// the client's own notification list, plus who sent it. `sentByName` is null for
// the system-generated types (scoring_*, limit_updated), which have no author.
export async function listUserNotifications(userId: number) {
  const rows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      data: notifications.data,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
      sentByName: adminUsers.fullName,
    })
    .from(notifications)
    .leftJoin(adminUsers, eq(notifications.sentByAdminId, adminUsers.id))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(100);

  return rows.map((r) => {
    const data = (r.data ?? {}) as Record<string, unknown>;
    return {
      id: r.id,
      type: r.type,
      // Custom rows carry their own text; system rows are rendered by the client
      // from `type` + `data`, so there is nothing to show here but the type.
      titleRu: typeof data.titleRu === 'string' ? data.titleRu : null,
      bodyRu: typeof data.bodyRu === 'string' ? data.bodyRu : null,
      sentByName: r.sentByName ?? null,
      readAt: r.readAt ? r.readAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    };
  });
}
