import { and, eq } from 'drizzle-orm'
import type { Db } from '../../db'
import { users, clients } from '../id/db/schema'
import { scoringHistories } from '../deals/db/schema'
import { queryInfoscore } from '../integrations/katm/service'
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
  consentId: string
  consentDate: string
}

export interface StartScoringResult {
  sessionId: string
  katm: {
    demandId: string
    score: number
    scoringClass: string
    scoringLevel: string
    activeLoans: number
    allDebtSum: number
    overdueCount: number
    overdueAmount: number
    hasDefaults: boolean
    hasCreditBan: boolean
  }
}

export async function startScoringSession(
  db: Db,
  input: StartScoringInput,
): Promise<StartScoringResult> {
  const [user] = await db
    .select({ id: users.id, pinfl: users.pinfl })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1)

  if (!user) throw Object.assign(new Error('user_not_found'), { statusCode: 404 })

  const [session] = await db
    .insert(scoringSessions)
    .values({
      userId: input.userId,
      consentId: input.consentId,
      consentDate: input.consentDate,
      status: 'running',
    })
    .returning({ id: scoringSessions.id })

  const sessionId = session!.id
  const now = new Date()

  const [katmPipeline] = await db
    .insert(scoringPipelines)
    .values({ sessionId, type: 'katm', status: 'running', startedAt: now })
    .returning({ id: scoringPipelines.id })

  await db.insert(scoringPipelines).values({ sessionId, type: 'card_scoring', status: 'pending' })

  try {
    const katmResult = await queryInfoscore(db, {
      pinfl: user.pinfl,
      claimId: sessionId,
      consentId: input.consentId,
    })

    await db
      .update(scoringPipelines)
      .set({
        status: 'completed',
        result: katmResult as unknown as Record<string, unknown>,
        completedAt: new Date(),
      })
      .where(eq(scoringPipelines.id, katmPipeline!.id))

    return {
      sessionId,
      katm: {
        demandId: katmResult.demandId,
        score: katmResult.score,
        scoringClass: katmResult.scoringClass,
        scoringLevel: katmResult.scoringLevel,
        activeLoans: katmResult.activeLoans,
        allDebtSum: katmResult.allDebtSum,
        overdueCount: katmResult.overdueCount,
        overdueAmount: katmResult.overdueAmount,
        hasDefaults: katmResult.hasDefaults,
        hasCreditBan: katmResult.hasCreditBan,
      },
    }
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
