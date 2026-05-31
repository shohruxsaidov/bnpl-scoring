import { and, eq } from 'drizzle-orm';
import type { Db } from '../../../db';
import { scoringHistories } from '../../deals/db/schema';
import { clients } from '../../id/db/schema';

// ---------------------------------------------------------------------------
// Record a scoring run (KATM + card scoring). Persisted the moment scoring
// completes — before any deal exists — so it always shows in the history.
// deal_id stays NULL until/unless the wizard reaches deal creation.
//
// Listing / detail views live in the platform-admin module
// (api/src/modules/admin/scoringHistory).
// ---------------------------------------------------------------------------

export interface CreateScoringInput {
  merchantId: bigint;
  clientId: bigint;
  scoreSum: number | null;
  coefficient: number | null;
  decision: string;
  /** Tiyin */
  platformCreditLimit: bigint;
  criteriaScores: Record<string, number> | null;
}

export async function createScoring(db: Db, input: CreateScoringInput): Promise<{ id: string }> {
  // Ensure the client belongs to this merchant and snapshot their data.
  const [client] = await db
    .select({
      id: clients.id,
      firstName: clients.firstName,
      lastName: clients.lastName,
      middleName: clients.middleName,
      passportNumber: clients.passportNumber,
      passportSerial: clients.passportSerial,
      pinfl: clients.pinfl,
      phone: clients.phone,
    })
    .from(clients)
    .where(and(eq(clients.id, input.clientId), eq(clients.merchantId, input.merchantId)))
    .limit(1);

  if (!client) throw Object.assign(new Error('client_not_found'), { code: 'client_not_found' });

  const [row] = await db
    .insert(scoringHistories)
    .values({
      firstName: client.firstName,
      lastName: client.lastName,
      middleName: client.middleName ?? null,
      passportNumber: client.passportNumber ?? null,
      passportSeries: client.passportSerial ?? null,
      pinfl: client.pinfl,
      phoneNumber: client.phone,
      criteriaScores: input.criteriaScores ?? null,
      scoreSum: input.scoreSum?.toString() ?? null,
      coefficient: input.coefficient != null ? input.coefficient.toString() : null,
      decision: input.decision,
      platformCreditLimit: input.platformCreditLimit,
    })
    .returning({ id: scoringHistories.id });

  return { id: row!.id.toString() };
}
