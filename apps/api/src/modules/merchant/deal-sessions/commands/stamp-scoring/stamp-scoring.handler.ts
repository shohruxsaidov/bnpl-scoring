import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { stepDataOf, type DealSessionRow, type ScoringStamp, type BailsmanItem } from '../../types';

export async function stampScoring(
  session: DealSessionRow,
  stamp: ScoringStamp,
  bailsmen?: BailsmanItem[],
): Promise<void> {
  const data = stepDataOf(session);
  const next = { ...data, scoring: stamp };
  if (bailsmen?.length) (next as typeof data).bailsmen = bailsmen;
  await db
    .update(dealSessions)
    .set({ stepData: next, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
}
