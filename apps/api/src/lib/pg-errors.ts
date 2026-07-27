// ---------------------------------------------------------------------------
// Postgres error shapes, seen through Drizzle.
//
// Drizzle wraps driver errors, so a thrown object carries neither `code` nor
// `constraint` at the top level — the real PostgresError hangs off `.cause`, and
// postgres.js spells the field `constraint_name`. A check written the obvious way
// (`err.code === '23505'`) is therefore DEAD CODE that silently never fires, and
// the failure it was guarding turns into a 500. Every shape is walked here so no
// caller has to remember that.
// ---------------------------------------------------------------------------

type PgLike = {
  code?: string;
  constraint?: string;
  constraint_name?: string;
  message?: string;
  cause?: unknown;
};

/** Postgres SQLSTATE for unique_violation. */
const UNIQUE_VIOLATION = '23505';

/**
 * True when `err` is a unique-violation on the named index.
 *
 * Matching the constraint rather than a bare 23505 matters: a handler that maps
 * any unique violation to one friendly message will report the wrong cause the
 * day a second unique index is added to the same table.
 */
export function isUniqueViolation(err: unknown, constraint: string): boolean {
  for (
    let e = err as PgLike | null | undefined, depth = 0;
    e && depth < 4;
    e = e.cause as PgLike, depth++
  ) {
    if (e.code !== UNIQUE_VIOLATION) continue;
    // The message fallback covers a driver that reports the code but not the
    // constraint name; without it a wrapped error degrades to an unhandled 500.
    if ((e.constraint ?? e.constraint_name) === constraint) return true;
    if (e.message?.includes(constraint)) return true;
  }
  return false;
}
