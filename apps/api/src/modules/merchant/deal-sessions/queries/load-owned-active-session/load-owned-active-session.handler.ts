import { eq } from 'drizzle-orm';
import { db } from '@db';
import { dealSessions } from '../../../../deals/schema';
import { err, isSessionStale, type DealSessionRow } from '../../types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Ownership-checked load WITHOUT the active guard. Status/polling endpoints
// (e.g. katm-status) must still read a session after it has been rejected, so
// they can surface the stamped knockout instead of a transport error.
export async function loadOwnedSession(id: string, agentId: number): Promise<DealSessionRow> {
  if (!UUID_RE.test(id)) throw err('session_not_found');
  const [row] = await db.select().from(dealSessions).where(eq(dealSessions.id, id)).limit(1);
  if (!row || row.agentId !== agentId) throw err('session_not_found');
  return row;
}

export async function loadOwnedActiveSession(id: string, agentId: number): Promise<DealSessionRow> {
  const row = await loadOwnedSession(id, agentId);
  if (row.status !== 'active') throw err('session_not_active');
  // Idle past the TTL — refuse to resume it even though the sweep hasn't flipped
  // the row yet. The actual status flip + claim retraction happen in the sweep
  // (≤5 min) or eagerly on GET /active / POST /, which hold the reject queue.
  // if (isSessionStale(row)) throw err('session_expired');
  return row;
}
