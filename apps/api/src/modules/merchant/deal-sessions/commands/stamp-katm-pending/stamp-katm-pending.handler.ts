import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { stepDataOf, type DealSessionRow, type KatmPendingState } from '../../types';

export async function stampKatmPending(
  session: DealSessionRow,
  state: KatmPendingState,
): Promise<void> {
  const data = stepDataOf(session);
  await db
    .update(dealSessions)
    .set({ stepData: { ...data, katmPending: state }, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
}
