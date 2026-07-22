import { desc, eq } from 'drizzle-orm';
import { db } from '@db';
import { adminUsers } from '@db/admin-users';
import { notifications } from '@db/notifications';
import type { SupportedLang } from '../../../../../i18n/index';
import { renderNotificationText } from '../../../../client/notifications/render';

// Everything ever delivered to this client's inbox — the admin-facing mirror of
// the client's own notification list, plus who sent it. `sentByName` is null for
// the system-generated types (scoring_*, limit_updated), which have no author.
//
// Text is rendered through the SAME renderer the client inbox and the push use,
// so an admin triaging a support call reads what the client read. It is rendered
// in the ADMIN's language, not the client's: this is a support tool, and the
// admin needs to understand the row, not reproduce it byte-for-byte.
export async function listUserNotifications(userId: number, lang: SupportedLang) {
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
    const { title, body } = renderNotificationText(r.type, lang, data);
    return {
      id: r.id,
      type: r.type,
      title,
      body,
      sentByName: r.sentByName ?? null,
      readAt: r.readAt ? r.readAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    };
  });
}
