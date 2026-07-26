import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import type { Queue } from 'bullmq';
import type { FastifyBaseLogger } from 'fastify';
import { db } from '@db';
import { notifications, type NotificationType } from '@db/notifications';
import { userDevices } from '@db/user-devices';
import type { SupportedLang } from '../../../i18n/index';
import { messaging } from '../../../lib/firebase';
import { renderNotificationText } from './render';

// ---------------------------------------------------------------------------
// notifications-push (BullMQ) — delivers the FCM push mirroring an inbox row.
// One job per notification: the worker resolves the user's tokened devices at
// send time, renders localized title/body per device language, and dispatches.
// The inbox row (written by notify()) is the source of truth; this push is
// best-effort. Soft-degrades when FCM has no credentials.
// ---------------------------------------------------------------------------

export const NOTIFICATIONS_PUSH_QUEUE = 'notifications-push';

export interface NotificationPushJobData {
  notificationId: string;
  userId: number;
}

// The producing Queue is created by the queue plugin and handed here, so
// notify() (called deep in the poller / request handlers) can enqueue without
// threading the queue through every call site. Null until the plugin registers
// (e.g. in unit tests without the queue plugin) — enqueue then no-ops and the
// inbox row still stands.
let queueRef: Queue<NotificationPushJobData> | null = null;

export function setNotificationsPushQueue(q: Queue<NotificationPushJobData>): void {
  queueRef = q;
}

export async function enqueueNotificationPush(data: NotificationPushJobData): Promise<void> {
  if (!queueRef) {
    console.warn('[notifications] push queue not initialized — push skipped', data);
    return;
  }
  await queueRef.add('push', data, {
    attempts: 3,
    backoff: { type: 'fixed', delay: 5_000 },
    removeOnComplete: true,
    removeOnFail: 100,
  });
}

// FCM error codes that mean the token is permanently dead (uninstall / rotated)
// — clear it from the device so we stop sending. Anything else is transient and
// left alone.
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

/**
 * Where tapping the push should land the app. Only actionable types get one —
 * news opens the inbox, which is the default with no `screen` at all.
 *
 * The values are a ROUTING HINT and nothing more. The app must re-fetch the
 * request from /client/deals/to-sign and render THAT: a payload arriving from
 * the network is not evidence a deal exists, the terms in it would be a snapshot
 * from whenever the push was minted, and a stale tap must find nothing rather
 * than something wrong.
 */
function pushRoute(type: NotificationType, data: Record<string, unknown>): Record<string, string> {
  if (type !== 'deal_signing_request') return {};
  const sessionId = data['dealSessionId'];
  return {
    action_type: 'deal_signing',
    ...(typeof sessionId === 'string' ? { dealSessionId: sessionId } : {}),
  };
}

async function unreadCount(userId: number): Promise<number> {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return r?.n ?? 0;
}

export async function processNotificationPushJob(
  data: NotificationPushJobData,
  log: FastifyBaseLogger,
): Promise<void> {
  const [row] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, data.notificationId))
    .limit(1);
  if (!row) return; // deleted before delivery — nothing to push

  if (!messaging) {
    log.warn({ notificationId: row.id }, 'FCM disabled (no credentials) — push skipped');
    return;
  }

  const devices = await db
    .select()
    .from(userDevices)
    .where(and(eq(userDevices.userId, data.userId), isNotNull(userDevices.fcmToken)));
  if (devices.length === 0) {
    log.info({ notificationId: row.id }, 'no push tokens for user — inbox only');
    return;
  }

  const unread = await unreadCount(data.userId);
  const payload = row.data as Record<string, unknown>;

  // Group tokens by device UI language — push text is localized per device.
  const byLang = new Map<SupportedLang, string[]>();
  for (const d of devices) {
    if (!d.fcmToken) continue;
    const lang: SupportedLang = d.language === 'uz' ? 'uz' : 'ru';
    const arr = byLang.get(lang) ?? [];
    arr.push(d.fcmToken);
    byLang.set(lang, arr);
  }

  const deadTokens: string[] = [];
  for (const [lang, tokens] of byLang) {
    const { title, body } = renderNotificationText(row.type, lang, payload, (reason) =>
      log.warn({ notificationId: row.id, type: row.type, lang }, reason),
    );
    // sendEachForMulticast resolves with per-token results (it does not throw on
    // partial failure). A total failure (FCM unreachable) rejects and BullMQ
    // retries the whole job. Partial transient failures are left best-effort —
    // retrying the whole job would re-deliver to already-succeeded tokens.
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      // FCM data values must all be strings — a number here is rejected at send.
      data: { notificationId: row.id, type: row.type, ...pushRoute(row.type, payload) },
      apns: { payload: { aps: { badge: unread, sound: 'default' } } },
    });
    res.responses.forEach((r, i) => {
      if (!r.success && r.error && DEAD_TOKEN_CODES.has(r.error.code)) {
        deadTokens.push(tokens[i]!);
      }
    });
  }

  if (deadTokens.length) {
    await db
      .update(userDevices)
      .set({ fcmToken: null, updatedAt: new Date() })
      .where(inArray(userDevices.fcmToken, deadTokens));
    log.info({ count: deadTokens.length }, 'cleared dead FCM tokens');
  }
}
