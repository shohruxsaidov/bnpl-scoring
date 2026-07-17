import { eq, sql } from 'drizzle-orm';
import { db } from '@db';
import { appRatings } from '@db/schema';

export async function getUserRating(userId: number) {
  const [row] = await db
    .select({ rating: appRatings.rating })
    .from(appRatings)
    .where(eq(appRatings.userId, userId))
    .limit(1);
  return row ?? null;
}

// Upsert on the primary key: submitting again replaces the value. This is what
// makes POST /client/ratings idempotent — a mobile client that retries after a
// dropped response writes the same value twice and nothing breaks.
//
// created_at is deliberately absent from the update set: it keeps meaning "when
// this user first rated", not "when they last did".
export async function upsertUserRating(userId: number, rating: number) {
  await db
    .insert(appRatings)
    .values({ userId, rating })
    .onConflictDoUpdate({
      target: appRatings.userId,
      set: { rating, updatedAt: new Date() },
    });
}

const STARS = [1, 2, 3, 4, 5] as const;

export async function getRatingSummary() {
  const rows = await db
    .select({
      rating: appRatings.rating,
      count: sql<number>`count(*)::int`,
    })
    .from(appRatings)
    .groupBy(appRatings.rating);

  const byStar = new Map(rows.map((r) => [r.rating, r.count]));
  // Densified to a fixed 1..5 shape so the admin UI never has to distinguish
  // "no 2-star ratings" from "the 2-star bucket is missing". Any out-of-range
  // row (only reachable by a direct SQL write — the range is an API-boundary
  // rule, not a CHECK) is excluded here but still counted in `count`/`average`.
  const histogram = Object.fromEntries(
    STARS.map((star) => [star, byStar.get(star) ?? 0]),
  ) as Record<(typeof STARS)[number], number>;

  const count = rows.reduce((sum, r) => sum + r.count, 0);
  const total = rows.reduce((sum, r) => sum + r.rating * r.count, 0);

  return {
    // null rather than 0 when nobody has rated: an average of 0 is
    // indistinguishable from a real (impossible) score and reads as terrible.
    average: count === 0 ? null : Math.round((total / count) * 100) / 100,
    count,
    histogram,
  };
}
