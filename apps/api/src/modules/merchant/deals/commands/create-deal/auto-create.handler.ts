import { eq } from 'drizzle-orm';
import { db } from '@db';
import { deals, dealSessions } from '../../../../deals/schema';
import { isDealSessionConflict } from '../../../../deals/blocking';
import { stepDataOf, type DealSessionRow } from '../../../deal-sessions/types';
import { createDealFromSession } from './create-deal.handler';

// ---------------------------------------------------------------------------
// Automatic deal creation — the act that used to be the agent's Создать сделку.
//
// The акцепт is the client's last decision; everything after it is bookkeeping the
// server can do itself. So the OTP endpoints call this the moment consent is
// stamped, and the agent's button becomes what it always should have been: a
// retry for the cases where the bookkeeping failed.
//
// Two rules govern this file, and they are the whole design:
//
//   1. IT NEVER THROWS. The акцепт is already committed by its own transaction and
//      must survive whatever happens here. A client who consented has consented —
//      there is no outcome in which we un-record that because a product went
//      inactive. Failures come back as a value.
//
//   2. THE REASON IS FOR THE AGENT. Every code createDealFromSession can raise is
//      actionable only at the counter (redo Товары, move the tariff) or not at all
//      (active_deal_exists). The client signed on their own phone and stopped
//      watching. So the code is parked on the run for the agent's screen, and the
//      caller decides how much of it — if any — the client is told.
// ---------------------------------------------------------------------------

export type AutoCreateResult =
  | { status: 'created'; dealId: string; dealNumber: number | null }
  // `cause` is carried for the caller's logger only — it is never serialized to
  // either screen. `code` is the whole of what a human is shown.
  | { status: 'failed'; code: string; cause?: unknown };

/** The Deal already built for this run, if there is one. Callers own the auth check. */
export async function loadDealForSession(sessionId: string) {
  const [row] = await db
    .select({ id: deals.id, dealNumber: deals.dealNumber })
    .from(deals)
    .where(eq(deals.dealSessionId, sessionId))
    .limit(1);
  return row ?? null;
}

/** Park the reason on the run so the agent's next poll surfaces it. Best-effort. */
async function stampFailure(session: DealSessionRow, code: string): Promise<void> {
  try {
    await db
      .update(dealSessions)
      .set({
        stepData: {
          ...stepDataOf(session),
          dealCreation: { status: 'failed', code, at: new Date().toISOString() },
        },
        updatedAt: new Date(),
      })
      .where(eq(dealSessions.id, session.id));
  } catch {
    // The agent loses the reason, not the ability to act: Создать сделку is still
    // on their screen and will raise the same code, out loud, when they press it.
  }
}

/** Clear a previous failure — a later attempt succeeded, or is about to be retried. */
async function clearFailure(session: DealSessionRow): Promise<void> {
  const data = stepDataOf(session);
  if (!data.dealCreation) return;
  const next = { ...data };
  delete (next as Record<string, unknown>)['dealCreation'];
  await db
    .update(dealSessions)
    .set({ stepData: next, updatedAt: new Date() })
    .where(eq(dealSessions.id, session.id));
}

/**
 * Build the Deal for a run whose акцепт has just been stamped.
 *
 * `session` MUST be the row returned by stampOtpSigning, not the one the caller
 * loaded before it — createDealFromSession reads the proofs out of step_data and
 * would refuse a row that predates the consent it is checking for.
 *
 * Idempotent by the run: a repeat call returns the Deal already built rather than
 * building a second one. The read below catches the sequential repeat (the common
 * case — a retried request, a double-tap); `deals_deal_session_idx` catches the
 * concurrent one, where both callers read before either wrote.
 */
export async function autoCreateDealAfterSigning(
  session: DealSessionRow,
): Promise<AutoCreateResult> {
  const existing = await loadDealForSession(session.id);
  if (existing) {
    return { status: 'created', dealId: existing.id, dealNumber: existing.dealNumber };
  }

  try {
    const deal = await createDealFromSession(session);
    await clearFailure(session);
    return { status: 'created', dealId: deal.id, dealNumber: deal.dealNumber };
  } catch (err: any) {
    // Lost the race for this run — the other caller's Deal is the run's Deal, and
    // this is a success from where the client is standing, not a failure.
    if (err?.code === 'deal_already_created' || isDealSessionConflict(err)) {
      const won = await loadDealForSession(session.id);
      if (won) return { status: 'created', dealId: won.id, dealNumber: won.dealNumber };
    }

    // Only coded failures are business outcomes. An unexpected error (the bureau
    // table unreachable, a bug) is still not allowed to escape — the акцепт would
    // survive but the caller would answer 500 to a client whose signature landed —
    // so it is flattened to a code the agent can retry against.
    const code = typeof err?.code === 'string' ? err.code : 'deal_creation_failed';
    await stampFailure(session, code);
    return { status: 'failed', code, cause: err };
  }
}
