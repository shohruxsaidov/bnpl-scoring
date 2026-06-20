import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { logEvent, type DealSessionRow } from '../../types';

export async function rejectSession(session: DealSessionRow): Promise<void> {
  await db
    .update(dealSessions)
    .set({ status: 'rejected', updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
  await logEvent(session.id, 'rejected', { reason: 'scoring_rejected' });
}
