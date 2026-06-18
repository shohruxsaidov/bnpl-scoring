import { and, eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import type { DealSessionRow } from '../../types';

export async function getActiveSession(agentId: number): Promise<DealSessionRow | null> {
  const [row] = await db
    .select()
    .from(dealSessions)
    .where(and(eq(dealSessions.agentId, agentId), eq(dealSessions.status, 'active')))
    .limit(1);
  return row ?? null;
}
