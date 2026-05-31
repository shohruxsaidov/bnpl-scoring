import webpush from 'web-push'
import { eq } from 'drizzle-orm'
import type { Db } from '../../db'
import { pushSubscriptions } from './db/schema'
import { env } from '../../env'

webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)

export interface PushSubscriptionInput {
  endpoint: string
  p256dh: string
  auth: string
}

export async function upsertSubscription(db: Db, userId: bigint, sub: PushSubscriptionInput) {
  await db
    .insert(pushSubscriptions)
    .values({ userId, ...sub })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh: sub.p256dh, auth: sub.auth, userId },
    })
}

export async function deleteSubscription(db: Db, userId: bigint, endpoint: string) {
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint))
}

export async function sendPushToUser(db: Db, userId: bigint, payload: unknown) {
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))

  if (!subs.length) return

  const json = JSON.stringify(payload)
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, json)
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint))
        }
      }
    }),
  )
}

export async function broadcastPush(db: Db, payload: unknown) {
  const subs = await db.select().from(pushSubscriptions)
  if (!subs.length) return

  const json = JSON.stringify(payload)
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, json)
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 410 || status === 404) {
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, s.endpoint))
        }
      }
    }),
  )
}
