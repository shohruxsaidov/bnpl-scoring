import { count, desc, eq } from 'drizzle-orm';
import { db } from '@db';
import { scorings } from '@db/scorings';
import { users } from '@db/users';
import type { ListScoringsParams } from './list-scorings.query';

export type { ListScoringsParams };

export interface ScoringListItem {
  id: number;
  userId: number | null;
  fullName: string | null;
  phone: string | null;
  status: string;
  score: number | null;
  creditLimit: string | null;
  currentPipeline: string | null;
  createdAt: string;
}

export async function listScorings(
  params: ListScoringsParams,
): Promise<{ scorings: ScoringListItem[]; total: number }> {
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: scorings.id,
        userId: scorings.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        phone: users.phone,
        status: scorings.status,
        score: scorings.score,
        creditLimit: scorings.creditLimit,
        currentPipeline: scorings.currentPipeline,
        createdAt: scorings.createdAt,
      })
      .from(scorings)
      // A scoring can exist before a user is attached — keep it visible.
      .leftJoin(users, eq(scorings.userId, users.id))
      .orderBy(desc(scorings.createdAt), desc(scorings.id))
      .limit(params.limit)
      .offset(params.offset),
    db.select({ total: count() }).from(scorings),
  ]);

  return {
    scorings: rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      fullName:
        row.firstName != null || row.lastName != null
          ? [row.firstName, row.lastName].filter(Boolean).join(' ')
          : null,
      phone: row.phone,
      status: row.status,
      score: row.score,
      creditLimit: row.creditLimit,
      currentPipeline: row.currentPipeline,
      createdAt: row.createdAt.toISOString(),
    })),
    total: totals[0]?.total ?? 0,
  };
}
