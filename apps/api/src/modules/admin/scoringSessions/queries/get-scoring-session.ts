import { eq } from 'drizzle-orm'
import type { Db } from '../../../../db'
import { scoringSessions, scoringPipelines, userLimits } from '../../../scoring/db/schema'
import { users } from '../../../id/db/schema'

export interface ScoringPipelineItem {
  id: string
  type: string
  status: string
  result: unknown
  error: string | null
  startedAt: string | null
  completedAt: string | null
}

export interface ScoringSessionDetail {
  id: string
  clientName: string
  clientPhone: string
  clientPinfl: string
  status: string
  consentId: string
  consentDate: string
  katmClaimId: string | null
  createdAt: string
  scoredAt: string | null
  pipelines: ScoringPipelineItem[]
  userLimit: {
    limitAmount: number
    scoredAt: string
    updatedAt: string
  } | null
}

export async function getScoringSession(db: Db, id: string): Promise<ScoringSessionDetail | null> {
  const rows = await db
    .select({
      id: scoringSessions.id,
      status: scoringSessions.status,
      consentId: scoringSessions.consentId,
      consentDate: scoringSessions.consentDate,
      katmClaimId: scoringSessions.katmClaimId,
      createdAt: scoringSessions.createdAt,
      scoredAt: scoringSessions.scoredAt,
      userId: scoringSessions.userId,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      pinfl: users.pinfl,
    })
    .from(scoringSessions)
    .innerJoin(users, eq(users.id, scoringSessions.userId))
    .where(eq(scoringSessions.id, id))
    .limit(1)

  const session = rows[0]
  if (!session) return null

  const pipelineRows = await db
    .select()
    .from(scoringPipelines)
    .where(eq(scoringPipelines.sessionId, id))

  const limitRows = await db
    .select()
    .from(userLimits)
    .where(eq(userLimits.userId, session.userId))
    .limit(1)

  const limit = limitRows[0] ?? null

  return {
    id: session.id,
    clientName: `${session.lastName} ${session.firstName}`,
    clientPhone: session.phone,
    clientPinfl: session.pinfl,
    status: session.status,
    consentId: session.consentId,
    consentDate: session.consentDate,
    katmClaimId: session.katmClaimId,
    createdAt: session.createdAt.toISOString(),
    scoredAt: session.scoredAt ? session.scoredAt.toISOString() : null,
    pipelines: pipelineRows.map((p) => ({
      id: p.id.toString(),
      type: p.type,
      status: p.status,
      result: p.result,
      error: p.error,
      startedAt: p.startedAt ? p.startedAt.toISOString() : null,
      completedAt: p.completedAt ? p.completedAt.toISOString() : null,
    })),
    userLimit:
      limit && limit.sessionId === id
        ? {
            limitAmount: Number(limit.limitAmount),
            scoredAt: limit.scoredAt.toISOString(),
            updatedAt: limit.updatedAt.toISOString(),
          }
        : null,
  }
}
