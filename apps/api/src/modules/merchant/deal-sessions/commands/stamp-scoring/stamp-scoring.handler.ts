import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { stepDataOf, logEvent, type DealSessionRow, type ScoringStamp } from '../../types';

export async function stampScoring(session: DealSessionRow, stamp: ScoringStamp): Promise<void> {
  const data = stepDataOf(session);
  await db
    .update(dealSessions)
    .set({ stepData: { ...data, scoring: stamp }, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
  await logEvent(session.id, 'scoring', stamp);
}
