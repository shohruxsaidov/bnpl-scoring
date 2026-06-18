import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { stepDataOf, logEvent, type DealSessionRow, type PrepaymentStamp } from '../../types';

export async function stampPrepayment(
  session: DealSessionRow,
  stamp: PrepaymentStamp,
): Promise<void> {
  const data = stepDataOf(session);
  await db
    .update(dealSessions)
    .set({ stepData: { ...data, prepayment: stamp }, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
  await logEvent(session.id, 'prepayment', stamp);
}
