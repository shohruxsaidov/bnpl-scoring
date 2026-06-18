import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { stepDataOf, logEvent, type DealSessionRow, type KatmStamp } from '../../types';

export async function stampKatm(session: DealSessionRow, stamp: KatmStamp): Promise<void> {
  const data = stepDataOf(session);
  const { katmPending: _drop, ...rest } = data;
  await db
    .update(dealSessions)
    .set({ stepData: { ...rest, katm: stamp }, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
  await logEvent(session.id, 'katm', stamp);
}
