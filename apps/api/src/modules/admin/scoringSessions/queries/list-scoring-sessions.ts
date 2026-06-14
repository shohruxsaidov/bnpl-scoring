import { desc, eq } from 'drizzle-orm'
import type { Db } from '../../../../db'
import { scoringSessions } from '../../../scoring/db/schema'
import { users } from '../../../id/db/schema'

export interface ScoringSessionListItem {
  id: string
  clientName: string
  clientPhone: string
  clientPinfl: string
  status: string
  consentDate: string
  createdAt: string
  scoredAt: string | null
}

export async function listScoringSessions(db: Db): Promise<ScoringSessionListItem[]> {
  const rows = await db
    .select({
      id: scoringSessions.id,
      status: scoringSessions.status,
      consentDate: scoringSessions.consentDate,
      createdAt: scoringSessions.createdAt,
      scoredAt: scoringSessions.scoredAt,
      firstName: users.firstName,
      lastName: users.lastName,
      phone: users.phone,
      pinfl: users.pinfl,
    })
    .from(scoringSessions)
    .innerJoin(users, eq(users.id, scoringSessions.userId))
    .orderBy(desc(scoringSessions.createdAt))

  return rows.map((r) => ({
    id: r.id,
    clientName: `${r.lastName} ${r.firstName}`,
    clientPhone: r.phone,
    clientPinfl: r.pinfl,
    status: r.status,
    consentDate: r.consentDate,
    createdAt: r.createdAt.toISOString(),
    scoredAt: r.scoredAt ? r.scoredAt.toISOString() : null,
  }))
}
