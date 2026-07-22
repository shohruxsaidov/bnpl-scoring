import { and, desc, eq, type SQL } from 'drizzle-orm';
import { db } from '@db';
import { branches, dealSessions, deals, merchantUsers, users } from '@db/schema';
import { calcBasketAmount } from '../../../../deals/signing/terms';
import { stepDataOf, wizardStepsFor, type DealSessionRow } from '../../types';

/**
 * The supervisor board's row. A flattened projection of the session head — the
 * raw step_data blob never leaves the API, because it carries the client's KATM
 * score, credit limit, PINFL and card PAN, and none of that belongs on a
 * "who is mid-sale right now" screen.
 */
export interface DealSessionListItem {
  id: string;
  status: string;
  currentStep: string;
  /** 1-based position in this run's step sequence — `full` and `reuse` differ. */
  stepIndex: number;
  stepCount: number;
  flowMode: 'full' | 'reuse';
  clientName: string | null;
  clientPhone: string | null;
  agentId: string;
  agentName: string | null;
  branchName: string | null;
  /** Basket total in som, or null before the products step. */
  amount: number | null;
  /** Stop-factor that killed the run — only ever set on a `rejected` session. */
  rejectReason: string | null;
  /** The deal a `completed` session became, for the row's click target. */
  dealId: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Why a rejected run died. Two sources: a pipeline stop-factor is stamped onto
 * katmPending.error, while a model reject leaves only a decision — so the code
 * is reconstructed. Read only for `rejected` sessions: on an open run the same
 * katmPending.error field carries technical failures (an unmapped MIB code),
 * which are retryable and not a verdict on the client.
 */
function rejectReasonOf(session: DealSessionRow): string | null {
  if (session.status !== 'rejected') return null;
  const data = stepDataOf(session);
  if (data.katmPending?.error) return data.katmPending.error;
  if (data.scoring?.decision === 'reject') return 'model_stop_factor';
  return null;
}

function toListItem(
  session: DealSessionRow,
  client: typeof users.$inferSelect | null,
  agent: typeof merchantUsers.$inferSelect | null,
  branch: typeof branches.$inferSelect | null,
  dealId: string | null,
): DealSessionListItem {
  const data = stepDataOf(session);
  const steps = wizardStepsFor(session);
  const lines = data.products?.lines ?? [];

  return {
    id: session.id,
    status: session.status,
    currentStep: session.currentStep,
    stepIndex: steps.indexOf(session.currentStep as (typeof steps)[number]) + 1,
    stepCount: steps.length,
    flowMode: data.flowMode ?? 'full',
    clientName: client ? `${client.firstName} ${client.lastName}` : null,
    clientPhone: client?.phone ?? null,
    agentId: session.agentId.toString(),
    agentName: agent?.fullName ?? null,
    branchName: branch?.name ?? null,
    amount: lines.length ? calcBasketAmount(lines) : null,
    rejectReason: rejectReasonOf(session),
    dealId,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  };
}

/**
 * Wizard runs for the board, newest activity first.
 *
 * `agentId` scopes the list to one agent — passed for the agent role, omitted
 * for a merchant admin, mirroring listDeals. The cap is a guard, not a page:
 * `active` is naturally tiny (at most one row per agent), but abandoned and
 * expired runs accumulate far faster than deals ever will, so the history
 * filters need a ceiling. Callers are told when they hit it.
 */
export async function listSessions(
  merchantId: number,
  agentId: number | undefined,
  opts: { status?: string; limit: number },
): Promise<{ sessions: DealSessionListItem[]; truncated: boolean }> {
  const filters: SQL[] = [eq(dealSessions.merchantId, merchantId)];
  if (agentId !== undefined) filters.push(eq(dealSessions.agentId, agentId));
  if (opts.status) filters.push(eq(dealSessions.status, opts.status));

  const rows = await db
    .select({
      session: dealSessions,
      client: users,
      agent: merchantUsers,
      branch: branches,
      dealId: deals.id,
    })
    .from(dealSessions)
    .leftJoin(users, eq(dealSessions.userId, users.id))
    .leftJoin(merchantUsers, eq(dealSessions.agentId, merchantUsers.id))
    .leftJoin(branches, eq(dealSessions.branchId, branches.id))
    .leftJoin(deals, eq(deals.dealSessionId, dealSessions.id))
    .where(and(...filters))
    .orderBy(desc(dealSessions.updatedAt))
    .limit(opts.limit + 1);

  const truncated = rows.length > opts.limit;
  return {
    sessions: rows
      .slice(0, opts.limit)
      .map((r) => toListItem(r.session, r.client, r.agent, r.branch, r.dealId ?? null)),
    truncated,
  };
}
