import { desc, eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { DEAL_SESSION_EXPIRED_NOTICE_WINDOW_MS } from '../../types';

export interface ExpiredNotice {
  /** deal_sessions.id of the reaped run. */
  id: string;
  /** ISO timestamp of when the session was flipped to `expired`. */
  expiredAt: string;
}

/**
 * Source for the "your deal expired — we recommend starting over" banner. Fires
 * only when the agent's MOST-RECENT run is `expired` (not `abandoned`/`rejected`
 * — those were deliberate closes) and was reaped within the notice window. A
 * newer run of any status outranks it, so the banner self-clears the moment the
 * agent starts a fresh session via POST /.
 */
export async function loadExpiredNotice(agentId: number): Promise<ExpiredNotice | null> {
  const [latest] = await db
    .select({
      id: dealSessions.id,
      status: dealSessions.status,
      updatedAt: dealSessions.updatedAt,
    })
    .from(dealSessions)
    .where(eq(dealSessions.agentId, agentId))
    .orderBy(desc(dealSessions.createdAt))
    .limit(1);

  if (!latest || latest.status !== 'expired') return null;

  const withinWindow =
    Date.now() - latest.updatedAt.getTime() <= DEAL_SESSION_EXPIRED_NOTICE_WINDOW_MS;
  if (!withinWindow) return null;

  return { id: latest.id, expiredAt: latest.updatedAt.toISOString() };
}
