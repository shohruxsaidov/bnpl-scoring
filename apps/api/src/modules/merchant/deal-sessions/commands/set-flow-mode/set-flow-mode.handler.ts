import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { stepDataOf, type DealSessionRow } from '../../types';

/**
 * Stamp which step sequence this run follows (ADR — reuse scoring). Called by
 * POST /:id/start after the client is resolved: 'reuse' when a valid cached
 * limit exists, 'full' otherwise (also clears a stale 'reuse' left by a prior
 * client selection on the same session).
 */
export async function setFlowMode(session: DealSessionRow, mode: 'full' | 'reuse'): Promise<void> {
  const data = stepDataOf(session);
  await db
    .update(dealSessions)
    .set({ stepData: { ...data, flowMode: mode }, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
}
