// ---------------------------------------------------------------------------
// Strict MAJOR.MINOR.PATCH parsing and ordering for mobile app versions.
//
// This comparator lives server-side and nowhere else. The force-update verdict
// is computed by the API rather than published as a policy for the app to
// evaluate locally, because a bug in here must be fixable with a deploy: the
// clients that need gating are, by definition, builds we cannot patch. Shipping
// the comparison to iOS and Android would mean three implementations, two of
// them only fixable through store review.
//
// Strict on purpose:
//   - Lexicographic ordering claims '1.10.0' < '1.9.0', which would silently
//     un-gate every stale build on the first double-digit minor release.
//   - Suffixed builds ('1.2.3-rc1') are rejected rather than guessed at. The
//     route answers 400 invalid_version, and the app's fail-open rule turns
//     that into 'ok' — a TestFlight build degrades gracefully instead of
//     receiving a wrong answer.
// ---------------------------------------------------------------------------

// Each part is capped at 4 digits so a parsed version can never exceed the
// varchar(20) the policy columns are sized for.
const SEMVER = /^(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/;

// Longest string SEMVER can match ('9999.9999.9999'). Mirror this in TypeBox
// maxLength wherever a version is accepted from the wire.
export const MAX_VERSION_LENGTH = 14;

export type Semver = readonly [major: number, minor: number, patch: number];

export function parseSemver(input: string): Semver | null {
  const m = SEMVER.exec(input.trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function isSemver(input: string): boolean {
  return parseSemver(input) !== null;
}

/** Negative if `a` is older than `b`, 0 if equal, positive if `a` is newer. */
export function compareSemver(a: Semver, b: Semver): number {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i]! - b[i]!;
  }
  return 0;
}
