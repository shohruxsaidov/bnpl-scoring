import type { Db } from '../../db/index.js'

export type FcmNotificationType = 'deal_approved' | 'deal_declined'

// Firebase Cloud Messaging is temporarily disabled.
export async function sendFcmToUser(
  _db: Db,
  _userId: bigint,
  _type: FcmNotificationType,
  _lang: 'ru' | 'uz',
  _data?: Record<string, string>,
): Promise<void> {}
