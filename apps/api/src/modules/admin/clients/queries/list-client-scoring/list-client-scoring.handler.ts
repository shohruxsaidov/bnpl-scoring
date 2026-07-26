import { desc, eq } from 'drizzle-orm';
import { db } from '@db';
import { scorings } from '@db/scorings';

// История скоринга for one client. This returned a hardcoded [] from the day
// scoring_histories was dropped (2026-06-25) until the Действия tab was built —
// leaving a tab that rendered an empty table for every client. It reads from the
// live `scorings` table now, which carries everything the old snapshot did.
//
// The wire shape is unchanged, so the existing DataTable needed no edit:
// `decision` is the four scorings statuses mapped onto the three the UI colours
// ('in_progress'/'passed' are both still-running as far as an admin is concerned),
// and `source` maps scorings.origin.

/** scorings.status → the decision vocabulary the client page renders. */
function toDecision(status: string): 'approved' | 'declined' | 'manual_review' {
  if (status === 'scored') return 'approved';
  if (status === 'rejected' || status === 'error') return 'declined';
  return 'manual_review';
}

export async function listUserScoring(userId: number): Promise<
  {
    id: string;
    source: 'wizard' | 'self-service';
    decision: string;
    score: number;
    limit: number;
    scoredAt: string;
    rejectReasonCode: string | null;
  }[]
> {
  const rows = await db
    .select({
      id: scorings.id,
      origin: scorings.origin,
      status: scorings.status,
      score: scorings.score,
      creditLimit: scorings.creditLimit,
      rejectReasonCode: scorings.rejectReasonCode,
      updatedAt: scorings.updatedAt,
    })
    .from(scorings)
    .where(eq(scorings.userId, userId))
    .orderBy(desc(scorings.id))
    .limit(100);

  return rows.map((r) => ({
    id: String(r.id),
    source: r.origin === 'client' ? ('self-service' as const) : ('wizard' as const),
    decision: toDecision(r.status),
    score: r.score ?? 0,
    // Stored as a whole-som string; the column renders it as an amount.
    limit: r.creditLimit ? Number(r.creditLimit) : 0,
    // updated_at, not created_at: a KATM run resolves asynchronously, and the
    // date an admin cares about is when the verdict landed.
    scoredAt: r.updatedAt.toISOString(),
    rejectReasonCode: r.rejectReasonCode,
  }));
}
