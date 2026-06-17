/**
 * KATM report polling (ADR-0025) — BullMQ worker logic.
 *
 * When /credit/report answers 05050 the report is built asynchronously and
 * KATM mandates ≥60 s between status checks. A BullMQ job (Redis-backed)
 * retries checkReportStatus on a fixed backoff up to KATM_POLL_MAX_ATTEMPTS
 * (~15 min); the Deal Session is resumable so the Agent can park the run.
 * Exhaustion fails the run — KATM failure hard-blocks the Deal.
 */

import { and, eq } from 'drizzle-orm'
import type { Queue } from 'bullmq'
import type { Db } from '../../../db'
import { env } from '../../../env'
import { ssePush } from '../../../lib/sse'
import { dealSessions } from '../../deals/db/schema'
import { clients, users } from '../../id/db/schema'
import { scoringPipelines, scoringSessions } from '../../scoring/db/schema'
import {
  stampKatm,
  stampKatmPending,
  type DealSessionRow,
  type KatmStamp,
} from '../../merchant/deal-sessions/service'
import { checkReportStatus, type KatmResult } from './service'

export const KATM_POLL_QUEUE = 'katm-report-poll'

export interface KatmPollJobData {
  flow: 'wizard' | 'self_service'
  /** deal_sessions.id (wizard) or scoring_sessions.id (self_service) */
  sessionId: string
  claimId: string
  token: string
  consentId: string
  /** ISO timestamp */
  consentDate: string
}

/** Thrown when the report is still being built — triggers a BullMQ retry. */
export class KatmReportPendingError extends Error {
  constructor() {
    super('katm_report_pending')
    this.name = 'KatmReportPendingError'
  }
}

export async function enqueueKatmPoll(queue: Queue<KatmPollJobData>, data: KatmPollJobData): Promise<void> {
  await queue.add('poll', data, {
    delay: env.KATM_POLL_INTERVAL_MS,
    attempts: env.KATM_POLL_MAX_ATTEMPTS,
    backoff: { type: 'fixed', delay: env.KATM_POLL_INTERVAL_MS },
    removeOnComplete: true,
    removeOnFail: true,
  })
}

// ---------------------------------------------------------------------------
// Worker body
// ---------------------------------------------------------------------------

export async function processKatmPollJob(db: Db, data: KatmPollJobData): Promise<void> {
  const outcome = await checkReportStatus(db, { claimId: data.claimId, token: data.token })
  if (outcome.status === 'pending') throw new KatmReportPendingError()

  if (data.flow === 'wizard') await finalizeWizard(db, data, outcome.result)
  else await finalizeSelfService(db, data, outcome.result)
}

/** Called by the worker's failed handler once all attempts are exhausted. */
export async function handleKatmPollFailure(db: Db, data: KatmPollJobData, err: Error): Promise<void> {
  const error = err instanceof KatmReportPendingError ? 'katm_report_timeout' : err.message
  if (data.flow === 'wizard') await failWizard(db, data, error)
  else await failSelfService(db, data, error)
}

// ---------------------------------------------------------------------------
// Wizard (Deal Session) finalizers
// ---------------------------------------------------------------------------

export function katmSummary(result: KatmResult) {
  return {
    demandId: result.demandId,
    score: result.score,
    scoringClass: result.scoringClass,
    scoringLevel: result.scoringLevel,
    activeLoans: result.activeLoans,
    allDebtSum: result.allDebtSum,
    overdueCount: result.overdueCount,
    overdueAmount: result.overdueAmount,
    maxOverdueDays: result.maxOverdueDays,
    totalContracts: result.totalContracts,
    totalClaims: result.totalClaims,
    avgMonthlyPayment: result.avgMonthlyPayment,
    hasDefaults: result.hasDefaults,
    hasCreditBan: result.hasCreditBan,
  }
}

async function loadWizardSession(db: Db, data: KatmPollJobData): Promise<DealSessionRow | null> {
  const [row] = await db.select().from(dealSessions).where(eq(dealSessions.id, data.sessionId)).limit(1)
  // The run may have been abandoned/superseded while we polled — drop silently
  if (!row || row.status !== 'active' || row.katmClaimId !== data.claimId) return null
  return row
}

async function finalizeWizard(db: Db, data: KatmPollJobData, result: KatmResult): Promise<void> {
  const session = await loadWizardSession(db, data)
  if (!session || !session.clientId) return

  const stamp: KatmStamp = {
    clientId: session.clientId.toString(),
    claimId: data.claimId,
    consentId: data.consentId,
    consentDate: data.consentDate.slice(0, 10),
    raw: result.raw ?? null,
    ...katmSummary(result),
  }
  await stampKatm(db, session, stamp)
  ssePush('employee', session.agentId.toString(), 'katm.completed', {
    dealSessionId: session.id,
    ...katmSummary(result),
  })
}

async function failWizard(db: Db, data: KatmPollJobData, error: string): Promise<void> {
  const session = await loadWizardSession(db, data)
  if (!session) return
  await stampKatmPending(db, session, {
    status: 'failed',
    startedAt: new Date().toISOString(),
    error,
  })
  ssePush('employee', session.agentId.toString(), 'katm.failed', {
    dealSessionId: session.id,
    error,
  })
}

// ---------------------------------------------------------------------------
// Self-service (Scoring Session) finalizers
// ---------------------------------------------------------------------------

async function finalizeSelfService(db: Db, data: KatmPollJobData, result: KatmResult): Promise<void> {
  await db
    .update(scoringPipelines)
    .set({
      status: 'completed',
      result: result as unknown as Record<string, unknown>,
      completedAt: new Date(),
    })
    .where(and(eq(scoringPipelines.sessionId, data.sessionId), eq(scoringPipelines.type, 'katm')))
}

async function failSelfService(db: Db, data: KatmPollJobData, error: string): Promise<void> {
  await Promise.all([
    db
      .update(scoringPipelines)
      .set({ status: 'failed', error, completedAt: new Date() })
      .where(and(eq(scoringPipelines.sessionId, data.sessionId), eq(scoringPipelines.type, 'katm'))),
    db
      .update(scoringSessions)
      .set({ status: 'failed' })
      .where(eq(scoringSessions.id, data.sessionId)),
  ])
}

// ---------------------------------------------------------------------------
// Shared helper — persist the bureau's subject id on the client/user row
// ---------------------------------------------------------------------------

export async function saveKatmSir(
  db: Db,
  subject: { clientId?: number; userId?: number },
  katmSir: string,
): Promise<void> {
  if (!katmSir) return
  if (subject.clientId) {
    await db.update(clients).set({ katmSir }).where(eq(clients.id, subject.clientId))
  }
  if (subject.userId) {
    await db.update(users).set({ katmSir }).where(eq(users.id, subject.userId))
  }
}
