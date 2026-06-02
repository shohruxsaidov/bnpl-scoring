import { and, eq, isNotNull } from 'drizzle-orm'
import type { Db } from '../../db/index.js'
import { clientDevices } from '../id/db/schema.js'
import { messaging } from '../../lib/firebase.js'

const MESSAGES = {
  deal_approved: {
    uz: { title: 'Ariza tasdiqlandi', body: "Tabriklaymiz! Arizangiz tasdiqlandi." },
    ru: { title: 'Заявка одобрена', body: 'Поздравляем! Ваша заявка одобрена.' },
  },
  deal_declined: {
    uz: { title: 'Ariza rad etildi', body: "Afsuski, arizangiz rad etildi." },
    ru: { title: 'Заявка отклонена', body: 'К сожалению, ваша заявка отклонена.' },
  },
} as const

export type FcmNotificationType = keyof typeof MESSAGES

export async function sendFcmToUser(
  db: Db,
  userId: bigint,
  type: FcmNotificationType,
  lang: 'ru' | 'uz',
  data?: Record<string, string>,
): Promise<void> {
  const devices = await db
    .select({ fcmToken: clientDevices.fcmToken })
    .from(clientDevices)
    .where(and(eq(clientDevices.userId, userId), isNotNull(clientDevices.fcmToken)))

  const tokens = devices.map((d) => d.fcmToken as string)
  if (!tokens.length) return

  const { title, body } = MESSAGES[type][lang]

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    data: { type, ...data },
  })

  // Null out tokens FCM has invalidated so they don't get retried.
  const stale = response.responses
    .flatMap((r, i) => {
      const code = r.error?.code
      if (!r.success && (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token')) {
        return [tokens[i]!]
      }
      return []
    })

  if (stale.length) {
    await Promise.all(
      stale.map((token) =>
        db
          .update(clientDevices)
          .set({ fcmToken: null, updatedAt: new Date() })
          .where(eq(clientDevices.fcmToken, token)),
      ),
    )
  }
}
