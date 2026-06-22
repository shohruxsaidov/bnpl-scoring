import { eq } from 'drizzle-orm'
import { db } from '@db'
import { dealSessions } from '../../../../deals/schema'
import { users, merchants, merchantUsers } from '@db/schema'
import type { GetScoringSessionQuery } from './get-scoring-session.query'

export interface DealSessionDetail {
  id: string
  clientName: string | null
  clientPhone: string | null
  clientPinfl: string | null
  merchantName: string
  agentName: string
  status: string
  currentStep: string
  katmClaimId: string | null
  stepData: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export async function getScoringSession({ id }: GetScoringSessionQuery): Promise<DealSessionDetail | null> {
  const rows = await db
    .select({
      id: dealSessions.id,
      status: dealSessions.status,
      currentStep: dealSessions.currentStep,
      katmClaimId: dealSessions.katmClaimId,
      stepData: dealSessions.stepData,
      createdAt: dealSessions.createdAt,
      updatedAt: dealSessions.updatedAt,
      merchantName: merchants.name,
      agentName: merchantUsers.fullName,
      clientFirstName: users.firstName,
      clientLastName: users.lastName,
      clientPhone: users.phone,
      clientPinfl: users.pinfl,
    })
    .from(dealSessions)
    .innerJoin(merchants, eq(merchants.id, dealSessions.merchantId))
    .innerJoin(merchantUsers, eq(merchantUsers.id, dealSessions.agentId))
    .leftJoin(users, eq(users.id, dealSessions.userId))
    .where(eq(dealSessions.id, id))
    .limit(1)

  const session = rows[0]
  if (!session) return null

  return {
    id: session.id,
    clientName: session.clientFirstName ? `${session.clientLastName} ${session.clientFirstName}` : null,
    clientPhone: session.clientPhone ?? null,
    clientPinfl: session.clientPinfl ?? null,
    merchantName: session.merchantName,
    agentName: session.agentName,
    status: session.status,
    currentStep: session.currentStep,
    katmClaimId: session.katmClaimId ?? null,
    stepData: session.stepData as Record<string, unknown>,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  }
}
