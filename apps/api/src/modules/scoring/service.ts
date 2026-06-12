import { and, eq } from 'drizzle-orm'
import type { Queue } from 'bullmq'
import type { Db } from '../../db'
import { users, clients } from '../id/db/schema'
import { scoringHistories } from '../deals/db/schema'
import { katmConsents } from '../integrations/db/schema'
import {
  allocateKatmClaimId,
  createKatmConsent,
  missingKatmFields,
  startKatmFlow,
} from '../integrations/katm/flow'
import {
  enqueueKatmPoll,
  katmSummary,
  saveKatmSir,
  type KatmPollJobData,
} from '../integrations/katm/poller'
import { addCard, confirmCard, scoreCard } from '../integrations/plumgate/service'
import type { KatmResult } from '../integrations/katm/service'
import { scoringSessions, scoringPipelines, userLimits } from './db/schema'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireSession(db: Db, sessionId: string, userId: bigint) {
  const [session] = await db
    .select()
    .from(scoringSessions)
    .where(and(eq(scoringSessions.id, sessionId), eq(scoringSessions.userId, userId)))
    .limit(1)

  if (!session) throw Object.assign(new Error('session_not_found'), { statusCode: 404 })
  if (session.status !== 'running') throw Object.assign(new Error('session_not_running'), { statusCode: 409 })
  return session
}

async function getPipeline(db: Db, sessionId: string, type: 'katm' | 'card_scoring') {
  const [pipeline] = await db
    .select()
    .from(scoringPipelines)
    .where(and(eq(scoringPipelines.sessionId, sessionId), eq(scoringPipelines.type, type)))
    .limit(1)
  return pipeline ?? null
}

function computeCoefficient(score: number): number {
  if (score >= 700) return 1.0
  if (score >= 600) return 0.8
  return 0
}

function buildCriteriaScores(cardScore: number, katmResult: KatmResult): Record<string, number> {
  return {
    cardScore,
    katmScore: katmResult.score,
    activeLoans: katmResult.activeLoans,
    overdueCount: katmResult.overdueCount,
  }
}

// ---------------------------------------------------------------------------
// Get current user limit
// ---------------------------------------------------------------------------

export async function getUserLimit(db: Db, userId: bigint) {
  const [row] = await db
    .select()
    .from(userLimits)
    .where(eq(userLimits.userId, userId))
    .limit(1)

  if (!row) return null
  return {
    limitAmount: Number(row.limitAmount),
    scoredAt: row.scoredAt.toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Start: create session and run KATM
// ---------------------------------------------------------------------------

export interface StartScoringInput {
  userId: bigint
  /** Backfill for users rows created before the KATM fields were captured (ADR-0025) */
  katmDetails?: {
    address: string
    regionCode: string
    districtCode: string
    docType: number
  }
}

export interface StartScoringResult {
  sessionId: string
  /** null while the report is being built asynchronously (status 05050) */
  katm: ReturnType<typeof katmSummary> | null
  pending: boolean
}

export async function startScoringSession(
  db: Db,
  queue: Queue<KatmPollJobData>,
  input: StartScoringInput,
): Promise<StartScoringResult> {
  const [user] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1)

  if (!user) throw Object.assign(new Error('user_not_found'), { statusCode: 404 })

  let subject = user
  if (input.katmDetails) {
    const [updated] = await db
      .update(users)
      .set({
        address: input.katmDetails.address,
        katmRegionCode: input.katmDetails.regionCode.padStart(2, '0'),
        katmDistrictCode: input.katmDetails.districtCode.padStart(3, '0'),
        docType: input.katmDetails.docType,
      })
      .where(eq(users.id, input.userId))
      .returning()
    subject = updated ?? user
  }

  const missing = missingKatmFields(subject)
  if (missing.length > 0) {
    throw Object.assign(new Error('user_katm_fields_missing'), {
      statusCode: 422,
      args: { missing },
    })
  }

  // Consent record first (ADR-0025) — its id/timestamp are the pAgreementId/
  // pAgreementDate sent to KATM; linked to the session right after creation
  const consent = await createKatmConsent(db, { channel: 'self_service', userId: input.userId })

  const [session] = await db
    .insert(scoringSessions)
    .values({
      userId: input.userId,
      consentId: consent.agreementId,
      consentDate: consent.agreementDate.toISOString().slice(0, 10),
      status: 'running',
    })
    .returning({ id: scoringSessions.id })

  const sessionId = session!.id
  await db
    .update(katmConsents)
    .set({ sessionId })
    .where(eq(katmConsents.id, BigInt(consent.agreementId)))

  const claimId = await allocateKatmClaimId(db)
  await db
    .update(scoringSessions)
    .set({ katmClaimId: claimId })
    .where(eq(scoringSessions.id, sessionId))

  const now = new Date()
  const [katmPipeline] = await db
    .insert(scoringPipelines)
    .values({ sessionId, type: 'katm', status: 'running', startedAt: now })
    .returning({ id: scoringPipelines.id })

  await db.insert(scoringPipelines).values({ sessionId, type: 'card_scoring', status: 'pending' })

  try {
    const outcome = await startKatmFlow(db, {
      claimId,
      consent,
      subject: {
        pinfl: subject.pinfl,
        passportSerial: subject.passportSerial!,
        passportNumber: subject.passportNumber!,
        docType: subject.docType!,
        regionCode: subject.katmRegionCode!,
        districtCode: subject.katmDistrictCode!,
        address: subject.address!,
        phone: subject.phone,
      },
    })

    if (outcome.status === 'banned') {
      throw Object.assign(new Error('credit_banned'), { statusCode: 409 })
    }

    await saveKatmSir(db, { userId: input.userId }, outcome.katmSir)

    if (outcome.status === 'pending') {
      // The BullMQ poller completes (or fails) the katm pipeline in the
      // background; the portal polls the session status meanwhile
      await enqueueKatmPoll(queue, {
        flow: 'self_service',
        sessionId,
        claimId,
        token: outcome.token,
        consentId: consent.agreementId,
        consentDate: consent.agreementDate.toISOString(),
      })
      return { sessionId, katm: null, pending: true }
    }

    await db
      .update(scoringPipelines)
      .set({
        status: 'completed',
        result: outcome.result as unknown as Record<string, unknown>,
        completedAt: new Date(),
      })
      .where(eq(scoringPipelines.id, katmPipeline!.id))

    return { sessionId, katm: katmSummary(outcome.result), pending: false }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    await Promise.all([
      db
        .update(scoringPipelines)
        .set({ status: 'failed', error: errorMessage, completedAt: new Date() })
        .where(eq(scoringPipelines.id, katmPipeline!.id)),
      db
        .update(scoringSessions)
        .set({ status: 'failed' })
        .where(eq(scoringSessions.id, sessionId)),
    ])
    throw err
  }
}

// ---------------------------------------------------------------------------
// Session status — polled by the portal while the KATM report is pending
// ---------------------------------------------------------------------------

export async function getScoringSessionStatus(db: Db, sessionId: string, userId: bigint) {
  const [session] = await db
    .select()
    .from(scoringSessions)
    .where(and(eq(scoringSessions.id, sessionId), eq(scoringSessions.userId, userId)))
    .limit(1)
  if (!session) throw Object.assign(new Error('session_not_found'), { statusCode: 404 })

  const katmPipeline = await getPipeline(db, sessionId, 'katm')
  const katm =
    katmPipeline?.status === 'completed' && katmPipeline.result
      ? katmSummary(katmPipeline.result as KatmResult)
      : null

  return {
    sessionId,
    status: session.status,
    katmStatus: katmPipeline?.status ?? 'pending',
    katm,
  }
}

// ---------------------------------------------------------------------------
// Card add: register card in PlumGate, triggers OTP to client's phone
// ---------------------------------------------------------------------------

export async function addScoringCard(
  db: Db,
  input: { sessionId: string; userId: bigint; cardNumber: string; expiry: string },
) {
  await requireSession(db, input.sessionId, input.userId)

  const katmPipeline = await getPipeline(db, input.sessionId, 'katm')
  if (katmPipeline?.status !== 'completed') {
    throw Object.assign(new Error('katm_not_completed'), { statusCode: 409 })
  }

  const [user] = await db
    .select({ id: users.id, phone: users.phone })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1)

  if (!user) throw Object.assign(new Error('user_not_found'), { statusCode: 404 })

  const result = await addCard(db, {
    clientId: input.userId.toString(),
    phone: user.phone,
    cardNumber: input.cardNumber,
    expiry: input.expiry,
  })

  return result // { sessionId: plumgateSessionId, maskedPhone }
}

// ---------------------------------------------------------------------------
// Card confirm: submit OTP to complete card registration
// ---------------------------------------------------------------------------

export async function confirmScoringCard(
  db: Db,
  input: { sessionId: string; userId: bigint; plumgateSessionId: string; otp: string },
) {
  await requireSession(db, input.sessionId, input.userId)

  const card = await confirmCard(db, { sessionId: input.plumgateSessionId, otp: input.otp })
  return { card } // { plumCardId, maskedPan, holderName, expiry, bank, pcType }
}

// ---------------------------------------------------------------------------
// Card score: run PlumGate scoring, finalize session, write limit + history
// ---------------------------------------------------------------------------

export interface CompleteScoringResult {
  scoreSum: number
  coefficient: number
  decision: string
  platformCreditLimit: number
  criteriaScores: Record<string, number>
}

export async function completeScoringCard(
  db: Db,
  input: {
    sessionId: string
    userId: bigint
    plumCardId: string
    pcType: 'uzcard' | 'humo'
  },
): Promise<CompleteScoringResult> {
  await requireSession(db, input.sessionId, input.userId)

  const [katmPipeline, cardPipeline] = await Promise.all([
    getPipeline(db, input.sessionId, 'katm'),
    getPipeline(db, input.sessionId, 'card_scoring'),
  ])

  if (katmPipeline?.status !== 'completed') {
    throw Object.assign(new Error('katm_not_completed'), { statusCode: 409 })
  }
  if (cardPipeline?.status !== 'pending') {
    throw Object.assign(new Error('card_scoring_already_started'), { statusCode: 409 })
  }

  await db
    .update(scoringPipelines)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(scoringPipelines.id, cardPipeline.id))

  const katmResult = katmPipeline.result as KatmResult

  try {
    const plumResult = await scoreCard(db, {
      plumCardId: input.plumCardId,
      pcType: input.pcType,
    })

    const coefficient = computeCoefficient(plumResult.score)
    const criteriaScores = buildCriteriaScores(plumResult.score, katmResult)
    const platformCreditLimit = BigInt(plumResult.limit)
    const now = new Date()

    await db
      .update(scoringPipelines)
      .set({
        status: 'completed',
        result: plumResult as unknown as Record<string, unknown>,
        completedAt: now,
      })
      .where(eq(scoringPipelines.id, cardPipeline.id))

    await db
      .update(scoringSessions)
      .set({ status: 'completed', scoredAt: now })
      .where(eq(scoringSessions.id, input.sessionId))

    const [user] = await db
      .select({
        firstName: users.firstName,
        lastName: users.lastName,
        middleName: users.middleName,
        passportSerial: users.passportSerial,
        passportNumber: users.passportNumber,
        pinfl: users.pinfl,
        phone: users.phone,
      })
      .from(users)
      .where(eq(users.id, input.userId))
      .limit(1)

    // Look up any existing clients row for this PINFL (may span multiple merchants)
    const [existingClient] = user?.pinfl
      ? await db
          .select({ id: clients.id })
          .from(clients)
          .where(eq(clients.pinfl, user.pinfl))
          .limit(1)
      : []

    await Promise.all([
      db
        .insert(userLimits)
        .values({
          userId: input.userId,
          limitAmount: platformCreditLimit,
          sessionId: input.sessionId,
          scoredAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: userLimits.userId,
          set: {
            limitAmount: platformCreditLimit,
            sessionId: input.sessionId,
            scoredAt: now,
            updatedAt: now,
          },
        }),

      db.insert(scoringHistories).values({
        clientId: existingClient?.id ?? null,
        firstName: user?.firstName ?? null,
        lastName: user?.lastName ?? null,
        middleName: user?.middleName ?? null,
        passportNumber: user?.passportNumber ?? null,
        passportSeries: user?.passportSerial ?? null,
        pinfl: user?.pinfl ?? null,
        phoneNumber: user?.phone ?? null,
        criteriaScores,
        scoreSum: plumResult.score.toString(),
        coefficient: coefficient.toString(),
        decision: plumResult.decision,
        platformCreditLimit,
      }),
    ])

    return {
      scoreSum: plumResult.score,
      coefficient,
      decision: plumResult.decision,
      platformCreditLimit: plumResult.limit,
      criteriaScores,
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    await Promise.all([
      db
        .update(scoringPipelines)
        .set({ status: 'failed', error: errorMessage, completedAt: new Date() })
        .where(eq(scoringPipelines.id, cardPipeline.id)),
      db
        .update(scoringSessions)
        .set({ status: 'failed' })
        .where(eq(scoringSessions.id, input.sessionId)),
    ])
    throw err
  }
}
