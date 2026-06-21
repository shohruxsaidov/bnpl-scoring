/**
 * KATM report polling (ADR-0025) — BullMQ worker logic.
 *
 * When /credit/report answers 05050 the report is built asynchronously and
 * KATM mandates ≥60 s between status checks. A BullMQ job (Redis-backed)
 * retries checkReportStatus on a fixed backoff up to KATM_POLL_MAX_ATTEMPTS
 * (~15 min); the Deal Session is resumable so the Agent can park the run.
 * Exhaustion fails the run — KATM failure hard-blocks the Deal.
 *
 * Both 077 and INPS reports are polled via the same queue with a reportType
 * discriminator. The session only advances once both reports are resolved.
 */

import { and, eq, isNotNull } from 'drizzle-orm'
import type { Queue } from 'bullmq'
import { db } from '@db'
import { katm077Reports } from '@db/katm-077-reports'
import { katmInpsReports } from '@db/katm-inps-reports'
import { env } from '../../../env'
import { ssePush } from '../../../lib/sse'
import { dealSessions } from '../../deals/schema'
import { scoringPipelines, scoringSessions } from '../../scoring/schema'
import { stampKatm } from '../../merchant/deal-sessions/commands/stamp-katm/stamp-katm.handler'
import { stampKatmPending } from '../../merchant/deal-sessions/commands/stamp-katm-pending/stamp-katm-pending.handler'
import type { DealSessionRow } from '../../merchant/deal-sessions/types'
import { checkReportStatus } from './queries/check-report-status/check-report-status.handler'
import { checkInpsReportStatus } from './queries/check-inps-report-status/check-inps-report-status.handler'
import type { KatmResult, InpsResult } from './service/shared'

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
  /** Defaults to '077' for backward compat with jobs in-flight */
  reportType?: '077' | 'inps'
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

export async function processKatmPollJob(data: KatmPollJobData): Promise<void> {
  const reportType = data.reportType ?? '077'

  if (reportType === 'inps') {
    const outcome = await checkInpsReportStatus({ claimId: data.claimId, token: data.token })
    if (outcome.status === 'pending') throw new KatmReportPendingError()
    await saveInpsReport(data.claimId, outcome.result)
  } else {
    const outcome = await checkReportStatus({ claimId: data.claimId, token: data.token })
    if (outcome.status === 'pending') throw new KatmReportPendingError()
    await saveKatmReport(data.claimId, outcome.result)
  }

  if (data.flow === 'wizard') await finalizeWizard(data)
  else await finalizeSelfService(data)
}

/** Called by the worker's failed handler once all attempts are exhausted. */
export async function handleKatmPollFailure(data: KatmPollJobData, err: Error): Promise<void> {
  const error = err instanceof KatmReportPendingError ? 'katm_report_timeout' : err.message
  if (data.flow === 'wizard') await failWizard(data, error)
  else await failSelfService(data, error)
}

// ---------------------------------------------------------------------------
// Coordination — session advances only once both 077 and INPS are resolved
// ---------------------------------------------------------------------------

async function bothReportsResolved(claimId: string): Promise<boolean> {
  const [r077, rInps] = await Promise.all([
    db
      .select({ demandId: katm077Reports.demandId })
      .from(katm077Reports)
      .where(and(eq(katm077Reports.claimId, claimId), isNotNull(katm077Reports.demandId)))
      .limit(1),
    db
      .select({ demandId: katmInpsReports.demandId })
      .from(katmInpsReports)
      .where(and(eq(katmInpsReports.claimId, claimId), isNotNull(katmInpsReports.demandId)))
      .limit(1),
  ])
  return r077.length > 0 && rInps.length > 0
}

async function load077Result(claimId: string): Promise<KatmResult | null> {
  const [row] = await db
    .select()
    .from(katm077Reports)
    .where(eq(katm077Reports.claimId, claimId))
    .limit(1)
  if (!row?.demandId) return null
  return {
    demandId: row.demandId,
    consentId: row.consentId ?? '',
    score: row.score ?? 0,
    scoringClass: row.scoringClass ?? '',
    scoringLevel: row.scoringLevel ?? '',
    activeLoans: row.activeLoans ?? 0,
    allDebtSum: row.allDebtSum ?? 0,
    overdueCount: row.overdueCount ?? 0,
    overdueAmount: row.overdueAmount ?? 0,
    maxOverdueDays: row.maxOverdueDays ?? 0,
    totalContracts: row.totalContracts ?? 0,
    totalClaims: row.totalClaims ?? 0,
    avgMonthlyPayment: row.avgMonthlyPayment ?? 0,
    hasDefaults: row.hasDefaults ?? false,
    hasCreditBan: row.hasCreditBan ?? false,
    raw: row.raw,
  }
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

async function loadWizardSession(data: KatmPollJobData): Promise<DealSessionRow | null> {
  const [row] = await db.select().from(dealSessions).where(eq(dealSessions.id, data.sessionId)).limit(1)
  if (!row || row.status !== 'active' || row.katmClaimId !== data.claimId) return null
  return row
}

export async function saveKatmReport(claimId: string, result: KatmResult): Promise<void> {
  await db
    .update(katm077Reports)
    .set({
      demandId: result.demandId,
      consentId: result.consentId,
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
      raw: result.raw as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(katm077Reports.claimId, claimId))
}

export async function saveInpsReport(claimId: string, result: InpsResult): Promise<void> {
  await db
    .update(katmInpsReports)
    .set({
      demandId: result.demandId,
      incomesAllSumma: result.incomesAllSumma,
      periodBegin: result.periodBegin,
      periodEnd: result.periodEnd,
      incomes: result.incomes as unknown as Record<string, unknown>[],
      raw: result.raw as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(katmInpsReports.claimId, claimId))
}

async function finalizeWizard(data: KatmPollJobData): Promise<void> {
  const session = await loadWizardSession(data)
  if (!session || !session.userId) return

  const allDone = await bothReportsResolved(data.claimId)
  if (!allDone) return // other report still pending — its job will call stampKatm

  const result077 = await load077Result(data.claimId)
  if (!result077) return

  await stampKatm(session)
  ssePush('employee', session.agentId.toString(), 'katm.completed', {
    dealSessionId: session.id,
    ...katmSummary(result077),
  })
}

async function failWizard(data: KatmPollJobData, error: string): Promise<void> {
  const session = await loadWizardSession(data)
  if (!session) return
  await stampKatmPending(session, {
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

async function finalizeSelfService(data: KatmPollJobData): Promise<void> {
  const allDone = await bothReportsResolved(data.claimId)
  if (!allDone) return // other report still pending

  await db
    .update(scoringPipelines)
    .set({ status: 'completed', completedAt: new Date() })
    .where(and(eq(scoringPipelines.sessionId, data.sessionId), eq(scoringPipelines.type, 'katm')))
}

async function failSelfService(data: KatmPollJobData, error: string): Promise<void> {
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
  subject: { userId?: number },
  _katmSir: string,
): Promise<void> {
  // users table has no katmSir column — no-op until schema adds it
}
