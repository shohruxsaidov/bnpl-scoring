import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '@db';
import type { CustomNotificationText } from '@db/notifications';
import { userDevices } from '@db/user-devices';
import { notify } from '../../../../client/notifications/service';

// ---------------------------------------------------------------------------
// Admin-authored push. Produces `custom` notifications through the same notify()
// pipeline the scoring engine uses — inbox row is the durable record, the FCM
// push is the mirror. Nothing here talks to FCM directly.
//
// Written for N recipients even though the only route today sends to one: a
// broadcast route can reuse it as-is, and the per-user dedupeKey already makes
// a batch idempotent.
// ---------------------------------------------------------------------------

export interface SendCustomPushInput {
  userIds: number[];
  text: CustomNotificationText;
  sentByAdminId: number;
  /** Minted by the compose dialog. Collapses double-clicks and request retries. */
  idempotencyKey: string;
}

/**
 * Devices that could actually receive a push right now — i.e. those still
 * holding an FCM token. A user with the app uninstalled has rows here but a
 * null token (the worker nulls them when FCM reports the token as dead).
 */
export async function countPushableDevices(userIds: number[]): Promise<number> {
  if (userIds.length === 0) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(userDevices)
    .where(and(inArray(userDevices.userId, userIds), isNotNull(userDevices.fcmToken)));
  return row?.n ?? 0;
}

export async function countPushableDevicesForUser(userId: number): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(userDevices)
    .where(and(eq(userDevices.userId, userId), isNotNull(userDevices.fcmToken)));
  return row?.n ?? 0;
}

/**
 * One notification per recipient. The dedupeKey is scoped per user so a batch
 * inserts one row each, while a replayed request (same idempotencyKey) collides
 * on every one of them and pushes nothing a second time.
 *
 * Returns the ids that were freshly created — a replay yields an empty array.
 */
export async function sendCustomPush(input: SendCustomPushInput): Promise<string[]> {
  const created: string[] = [];

  for (const userId of input.userIds) {
    const id = await notify({
      userId,
      type: 'custom',
      data: { ...input.text },
      dedupeKey: `admin_push:${input.idempotencyKey}:${userId}`,
      sentByAdminId: input.sentByAdminId,
    });
    if (id) created.push(id);
  }

  return created;
}
