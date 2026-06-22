import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { stepDataOf, type DealSessionRow } from '../../types';

export async function stampKatm(session: DealSessionRow): Promise<void> {
  const data = stepDataOf(session);
  const { katmPending: _drop, ...rest } = data;
  await db
    .update(dealSessions)
    .set({ stepData: rest, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
}
