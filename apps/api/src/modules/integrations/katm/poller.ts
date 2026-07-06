/**
 * KATM report polling (ADR-0025) — BullMQ worker logic.
 *
 * When /credit/report answers 05050 the report is built asynchronously and
 * KATM mandates ≥60 s between status checks. A BullMQ job (Redis-backed)
 * retries checkReportStatus on a fixed backoff up to KATM_POLL_MAX_ATTEMPTS
 * (~15 min); the Deal Session is resumable so the Agent can park the run.
 * Exhaustion fails the run — KATM failure hard-blocks the Deal.
 *
 * Reports are polled for the Wizard (Deal Session) flow only.
 *
 * Both 077 and INPS reports are polled via the same queue with a reportType
 * discriminator. The session only advances once both reports are resolved.
 */

import { eq } from 'drizzle-orm'
import type { Queue } from 'bullmq'
import { db } from '@db'
import { katm077Reports } from '@db/katm-077-reports'
import { katmMibReports } from '@db/katm-mib-reports'
import { katmInpsReports } from '@db/katm-inps-reports'
import { env } from '../../../env'
import { dealSessions } from '../../deals/schema'
import { stampKatm } from '../../merchant/deal-sessions/commands/stamp-katm/stamp-katm.handler'
import { stampKatmPending } from '../../merchant/deal-sessions/commands/stamp-katm-pending/stamp-katm-pending.handler'
import { rejectSession } from '../../merchant/deal-sessions/commands/reject-session/reject-session.handler'
import type { DealSessionRow } from '../../merchant/deal-sessions/types'
import { checkReportStatus } from './queries/check-report-status/check-report-status.handler'
import { checkMibReportStatus } from './queries/check-mib-report-status/check-mib-report-status.handler'
import { checkInpsReportStatus } from './queries/check-inps-report-status/check-inps-report-status.handler'
import { MIB_PASS_CODES, type KatmResult, type InpsResult, type MibResult } from './service/shared'
import { evaluate077, evaluateInps, evaluateMib, type PipelineStepResult } from './flow'
import { loadScoringById, loadScoringBySession, markError } from '../../scoring/pipelines/store'
import { applyClientStep } from '../../client/scoring/finalize'

export const KATM_POLL_QUEUE = 'katm-report-poll'

export interface KatmPollJobData {
  /** deal_sessions.id — set for merchant runs; omitted for client runs. */
  sessionId?: string
  /** scorings.id — set on all new jobs (both origins). Legacy jobs carry only sessionId. */
  scoringId?: number
  /** Which entry point opened the run. Absent on legacy jobs → treated as 'merchant'. */
  origin?: 'merchant' | 'client'
  claimId: string
  token: string
  consentId: string
  /** ISO timestamp */
  consentDate: string
  /** Defaults to '077' for backward compat with jobs in-flight */
  reportType?: '077' | 'inps' | 'mib'
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

export async function processKatmPollJob(
  data: KatmPollJobData,
  queue: Queue<KatmPollJobData>,
): Promise<void> {
  if (data.origin === 'client') {
    await processClientPollJob(data, queue)
    return
  }

  const reportType = data.reportType ?? '077'

  const session = await loadWizardSession(data)
  const scoring = session ? await loadScoringBySession(session.id) : null

  if (reportType === 'mib') {
    const outcome = await checkMibReportStatus({ claimId: data.claimId, token: data.token })
    if (outcome.status === 'pending') throw new KatmReportPendingError()
    await saveMibReport(data.claimId, outcome.result)
    if (!session || !scoring) return
    // evaluateMib chains into the chargeable 077 request only on a clean result.
    const step = await evaluateMib(scoring.id, data.claimId, outcome.result)
    await applyKatmStep(step, session, queue, data)
  } else if (reportType === 'inps') {
    const outcome = await checkInpsReportStatus({ claimId: data.claimId, token: data.token })
    if (outcome.status === 'pending') throw new KatmReportPendingError()
    await saveInpsReport(data.claimId, outcome.result)
    if (!session || !scoring) return
    const step = await evaluateInps(scoring.id, outcome.result)
    await applyKatmStep(step, session, queue, data)
  } else {
    const outcome = await checkReportStatus({ claimId: data.claimId, token: data.token })
    if (outcome.status === 'pending') throw new KatmReportPendingError()
    await saveKatmReport(data.claimId, outcome.result)
    if (!session || !scoring) return
    // evaluate077 chains into the chargeable INPS request only if 077 passed.
    const step = await evaluate077(scoring.id, data.claimId, outcome.result)
    await applyKatmStep(step, session, queue, data)
  }
}

/**
 * Client run poll — no deal session; the scorings row (loaded by scoringId) is
 * the read model. Same status-check/save/evaluate spine as the merchant path,
 * but completion runs the model + writes the credit limit (applyClientStep) and
 * enqueues the next poll when a chargeable report goes async.
 */
async function processClientPollJob(
  data: KatmPollJobData,
  queue: Queue<KatmPollJobData>,
): Promise<void> {
  const reportType = data.reportType ?? '077'
  const scoring = data.scoringId != null ? await loadScoringById(data.scoringId) : null

  let step: PipelineStepResult
  if (reportType === 'mib') {
    const outcome = await checkMibReportStatus({ claimId: data.claimId, token: data.token })
    if (outcome.status === 'pending') throw new KatmReportPendingError()
    await saveMibReport(data.claimId, outcome.result)
    if (!scoring) return
    step = await evaluateMib(scoring.id, data.claimId, outcome.result)
  } else if (reportType === 'inps') {
    const outcome = await checkInpsReportStatus({ claimId: data.claimId, token: data.token })
    if (outcome.status === 'pending') throw new KatmReportPendingError()
    await saveInpsReport(data.claimId, outcome.result)
    if (!scoring) return
    step = await evaluateInps(scoring.id, outcome.result)
  } else {
    const outcome = await checkReportStatus({ claimId: data.claimId, token: data.token })
    if (outcome.status === 'pending') throw new KatmReportPendingError()
    await saveKatmReport(data.claimId, outcome.result)
    if (!scoring) return
    step = await evaluate077(scoring.id, data.claimId, outcome.result)
  }

  const outcome = await applyClientStep(step, scoring)
  if (outcome.status === 'pending') {
    await enqueueKatmPoll(queue, {
      ...data,
      token: outcome.enqueue.token,
      reportType: outcome.enqueue.reportType,
    })
  }
}

/**
 * Reflect a KATM chain step onto the deal session (the wizard's read model) and
 * enqueue the next poll when a follow-on report went async.
 */
async function applyKatmStep(
  step: PipelineStepResult,
  session: DealSessionRow,
  queue: Queue<KatmPollJobData>,
  data: KatmPollJobData,
): Promise<void> {
  if (step.kind === 'enqueue_poll') {
    await enqueueKatmPoll(queue, { ...data, token: step.token, reportType: step.reportType })
    await stampKatmPending(session, { status: 'pending', startedAt: new Date().toISOString() })
    return
  }
  if (step.kind === 'rejected') {
    await stampKatmPending(session, {
      status: 'failed',
      startedAt: new Date().toISOString(),
      error: step.reasonCode,
    })
    await rejectSession(session)
    return
  }
  if (step.kind === 'failed') {
    // Technical/needs-review failure — fail the KATM step but do NOT close the
    // session as rejected; it can be retried once the gap is resolved.
    await stampKatmPending(session, {
      status: 'failed',
      startedAt: new Date().toISOString(),
      error: step.reason,
    })
    return
  }
  // gates_passed — all KATM stop-factors cleared; advance the wizard.
  await stampKatm(session)
}

/** Called by the worker's failed handler once all attempts are exhausted. */
export async function handleKatmPollFailure(data: KatmPollJobData, err: Error): Promise<void> {
  const error = err instanceof KatmReportPendingError ? 'katm_report_timeout' : err.message
  // Client run — fail the scoring run; no session to stamp. No credit-limit row
  // is written (a technical timeout is retryable), so /status shows 'error'.
  if (data.origin === 'client') {
    if (data.scoringId != null) await markError(data.scoringId)
    return
  }
  await failWizard(data, error)
}

// ---------------------------------------------------------------------------
// Wizard (Deal Session) helpers
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
      hasJuridical: result.hasJuridical,
      hasDecommission: result.hasDecommission,
      overdue30Count: result.overdue30Count,
      overdue30to60Count: result.overdue30to60Count,
      overdue60to90Count: result.overdue60to90Count,
      overdue90Count: result.overdue90Count,
      pledgerLiability: result.pledgerLiability,
      raw: result.raw as Record<string, unknown>,
      status: 'completed',
      updatedAt: new Date(),
    })
    .where(eq(katm077Reports.claimId, claimId))
}

export async function saveMibReport(claimId: string, result: MibResult): Promise<void> {
  await db
    .update(katmMibReports)
    .set({
      resultCode: result.resultCode,
      resultMessage: result.resultMessage,
      passed: MIB_PASS_CODES.includes(result.resultCode as (typeof MIB_PASS_CODES)[number]),
      raw: result.raw as Record<string, unknown>,
      status: 'completed',
      updatedAt: new Date(),
    })
    .where(eq(katmMibReports.claimId, claimId))
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
      status: 'completed',
      updatedAt: new Date(),
    })
    .where(eq(katmInpsReports.claimId, claimId))
}

async function failWizard(data: KatmPollJobData, error: string): Promise<void> {
  const session = await loadWizardSession(data)
  if (!session) return
  await stampKatmPending(session, {
    status: 'failed',
    startedAt: new Date().toISOString(),
    error,
  })
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
