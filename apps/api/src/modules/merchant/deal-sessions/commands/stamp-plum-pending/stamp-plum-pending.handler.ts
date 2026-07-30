import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { stepDataOf, type DealSessionRow, type PlumPendingState } from '../../types';

/** Open or update the plum_card wait on a session (mirrors stampKatmPending). */
export async function stampPlumPending(
  session: DealSessionRow,
  state: PlumPendingState,
): Promise<void> {
  const data = stepDataOf(session);
  await db
    .update(dealSessions)
    .set({ stepData: { ...data, plumPending: state }, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
}

/**
 * Drop the wait once the model has run. Left behind, a resolved plumPending would
 * keep the session exempt from the idle sweeper forever (see isSessionStale) and
 * keep the polling GET answering 'pending' after the verdict was stamped.
 */
export async function clearPlumPending(session: DealSessionRow): Promise<void> {
  const { plumPending: _dropped, ...rest } = stepDataOf(session);
  await db
    .update(dealSessions)
    .set({ stepData: rest, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
}
