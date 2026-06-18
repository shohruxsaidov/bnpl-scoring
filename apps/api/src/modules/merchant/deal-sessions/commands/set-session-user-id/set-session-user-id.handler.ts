import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import type { DealSessionRow } from '../../types';

export async function setSessionUserId(session: DealSessionRow, userId: number): Promise<void> {
  if (session.userId === userId) return;
  await db
    .update(dealSessions)
    .set({ userId, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
}
