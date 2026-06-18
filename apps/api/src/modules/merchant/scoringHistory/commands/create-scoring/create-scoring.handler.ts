import { eq } from 'drizzle-orm';
import { db } from '@db';
import { scoringHistories } from '../../../../deals/schema';
import { users } from '@db/schema';
import type { CreateScoringInput } from './create-scoring.command';

export async function createScoring(input: CreateScoringInput): Promise<{ id: string }> {
  const [user] = await db
    .select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      middleName: users.middleName,
      passportNumber: users.passportNumber,
      passportSeries: users.passportSeries,
      pinfl: users.pinfl,
      phone: users.phone,
    })
    .from(users)
    .where(eq(users.id, input.userId))
    .limit(1);

  if (!user) throw Object.assign(new Error('user_not_found'), { code: 'user_not_found' });

  const [row] = await db
    .insert(scoringHistories)
    .values({
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName ?? null,
      passportNumber: user.passportNumber ?? null,
      passportSeries: user.passportSeries ?? null,
      pinfl: user.pinfl,
      phoneNumber: user.phone,
      criteriaScores: input.criteriaScores ?? null,
      scoreSum: input.scoreSum?.toString() ?? null,
      coefficient: input.coefficient != null ? input.coefficient.toString() : null,
      decision: input.decision,
      platformCreditLimit: input.platformCreditLimit,
    })
    .returning({ id: scoringHistories.id });

  return { id: row!.id.toString() };
}
