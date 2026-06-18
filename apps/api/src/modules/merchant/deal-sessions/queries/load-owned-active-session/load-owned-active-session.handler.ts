import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { err, type DealSessionRow } from '../../types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function loadOwnedActiveSession(
  id: string,
  agentId: number,
): Promise<DealSessionRow> {
  if (!UUID_RE.test(id)) throw err('session_not_found');
  const [row] = await db.select().from(dealSessions).where(eq(dealSessions.id, id)).limit(1);
  if (!row || row.agentId !== agentId) throw err('session_not_found');
  if (row.status !== 'active') throw err('session_not_active');
  return row;
}
