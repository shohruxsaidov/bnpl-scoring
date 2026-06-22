import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { type DealSessionRow } from '../../types';

export async function abandonSession(session: DealSessionRow): Promise<void> {
  await db
    .update(dealSessions)
    .set({ status: 'abandoned', updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
}
