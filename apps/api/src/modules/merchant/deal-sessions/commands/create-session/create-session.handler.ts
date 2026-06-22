import { and, eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import type { CreateSessionCommand } from './create-session.command';
import type { DealSessionRow } from '../../types';

export async function createSession(input: CreateSessionCommand): Promise<DealSessionRow> {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(dealSessions)
      .where(and(eq(dealSessions.agentId, input.agentId), eq(dealSessions.status, 'active')))
      .limit(1);
    if (existing) {
      await tx
        .update(dealSessions)
        .set({ status: 'abandoned', updatedAt: new Date() })
        .where(eq(dealSessions.id, existing.id));
    }

    const [session] = await tx
      .insert(dealSessions)
      .values({
        merchantId: input.merchantId,
        branchId: input.branchId,
        agentId: input.agentId,
        userId: input.userId ? Number(input.userId) : undefined,
      })
      .returning();
    if (!session) throw new Error('session_insert_failed');

    return session;
  });
}
