import webpush from 'web-push'
import { and, eq } from 'drizzle-orm'
import type { Db } from '../../db'
import { pushSubscriptions } from './db/schema'
import { env } from '../../env'

webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)

export interface PushSubscriptionInput {
  endpoint: string
  p256dh: string
  auth: string
}

export async function upsertSubscription(
  db: Db,
  actorType: 'client' | 'employee',
  userId: bigint,
  sub: PushSubscriptionInput,
) {
  await db
    .insert(pushSubscriptions)
    .values({ actorType, userId, ...sub })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { p256dh: sub.p256dh, auth: sub.auth, userId, actorType },
    })
}

export async function deleteSubscription(db: Db, endpoint: string) {
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint))
}

async function sendPush(db: Db, actorType: 'client' | 'employee', userId: bigint, payload: unknown) {
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.actorType, actorType), eq(pushSubscriptions.userId, userId)))

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

export function sendPushToUser(db: Db, userId: bigint, payload: unknown) {
  return sendPush(db, 'client', userId, payload)
}

export function sendPushToEmployee(db: Db, employeeId: bigint, payload: unknown) {
  return sendPush(db, 'employee', employeeId, payload)
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
