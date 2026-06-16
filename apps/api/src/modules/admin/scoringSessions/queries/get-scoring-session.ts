import { asc, eq } from 'drizzle-orm'
import type { Db } from '../../../../db'
import { dealSessions, dealSessionEvents } from '../../../deals/db/schema'
import { clients, merchants, merchantUsers } from '../../../id/db/schema'

export interface DealSessionEventItem {
  id: string
  step: string
  createdAt: string
}

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
  events: DealSessionEventItem[]
}

export async function getScoringSession(db: Db, id: string): Promise<DealSessionDetail | null> {
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
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      clientPhone: clients.phone,
      clientPinfl: clients.pinfl,
    })
    .from(dealSessions)
    .innerJoin(merchants, eq(merchants.id, dealSessions.merchantId))
    .innerJoin(merchantUsers, eq(merchantUsers.id, dealSessions.agentId))
    .leftJoin(clients, eq(clients.id, dealSessions.clientId))
    .where(eq(dealSessions.id, id))
    .limit(1)

  const session = rows[0]
  if (!session) return null

  const eventRows = await db
    .select()
    .from(dealSessionEvents)
    .where(eq(dealSessionEvents.sessionId, id))
    .orderBy(asc(dealSessionEvents.createdAt))

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
    events: eventRows.map((e) => ({
      id: e.id.toString(),
      step: e.step,
      createdAt: e.createdAt.toISOString(),
    })),
  }
}
