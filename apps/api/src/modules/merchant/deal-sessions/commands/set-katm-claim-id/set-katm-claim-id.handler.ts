import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import type { DealSessionRow } from '../../types';

export async function setKatmClaimId(session: DealSessionRow, claimId: string): Promise<void> {
  await db
    .update(dealSessions)
    .set({ katmClaimId: claimId, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
}
