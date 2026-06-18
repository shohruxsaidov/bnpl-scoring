import { desc, eq } from 'drizzle-orm'
import { db } from '@db'
import { dealSessions } from '../../../../deals/schema'
import { users, merchants, merchantUsers } from '@db/schema'

export interface DealSessionListItem {
  id: string
  clientName: string | null
  clientPhone: string | null
  clientPinfl: string | null
  merchantName: string
  agentName: string
  status: string
  currentStep: string
  katmClaimId: string | null
  createdAt: string
  updatedAt: string
}

export async function listScoringSessions(): Promise<DealSessionListItem[]> {
  const rows = await db
    .select({
      id: dealSessions.id,
      status: dealSessions.status,
      currentStep: dealSessions.currentStep,
      katmClaimId: dealSessions.katmClaimId,
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
    .orderBy(desc(dealSessions.createdAt))

  return rows.map((r) => ({
    id: r.id,
    clientName: r.clientFirstName ? `${r.clientLastName} ${r.clientFirstName}` : null,
    clientPhone: r.clientPhone ?? null,
    clientPinfl: r.clientPinfl ?? null,
    merchantName: r.merchantName,
    agentName: r.agentName,
    status: r.status,
    currentStep: r.currentStep,
    katmClaimId: r.katmClaimId ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }))
}
