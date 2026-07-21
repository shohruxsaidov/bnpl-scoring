import { timingSafeEqual } from 'node:crypto';
import { env } from '@env';
import { paymeErrors } from './errors';

// Payme's Basic auth login is the literal string `Paycom` for every merchant;
// the password is the cashbox key. Test and production cashboxes carry different
// keys, which is why this reads from the environment rather than a config table:
// the environment IS the test/prod switch, and a test key must never be able to
// authenticate against production data.
const PAYME_LOGIN = 'Paycom';

/** Constant-time compare that also tolerates length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // timingSafeEqual throws on unequal lengths, and the throw itself leaks length.
  if (bufA.length !== bufB.length) {
    // Still burn a comparison so the timing does not distinguish the two cases.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify the Authorization header. Throws PaymeRpcError(-32504) on any failure —
 * missing header, wrong scheme, wrong login, wrong key — with no detail about
 * which, since the caller is either Payme (who knows) or an attacker (who
 * should not learn).
 */
export function assertPaymeAuth(header: string | undefined): void {
  if (!env.PAYME_KEY) throw paymeErrors.unauthorized();
  if (!header || !header.toLowerCase().startsWith('basic ')) throw paymeErrors.unauthorized();

  let decoded: string;
  try {
    decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
  } catch {
    throw paymeErrors.unauthorized();
  }

  const separator = decoded.indexOf(':');
  if (separator < 0) throw paymeErrors.unauthorized();

  const login = decoded.slice(0, separator);
  const key = decoded.slice(separator + 1);

  // Evaluate both halves regardless of the first result — short-circuiting here
  // would make a wrong login measurably faster than a wrong key.
  const loginOk = safeEqual(login, PAYME_LOGIN);
  const keyOk = safeEqual(key, env.PAYME_KEY);
  if (!loginOk || !keyOk) throw paymeErrors.unauthorized();
}

/**
 * IP allowlist. Empty config means "allow any" — correct for local development,
 * and the reason PAYME_ALLOWED_IPS must be set in every deployed environment.
 *
 * This is a second lock, not the lock: the key above is what actually protects
 * the endpoint. The allowlist exists because this route opts out of the global
 * rate limiter, and an unauthenticated flood should be dropped before it reaches
 * a database transaction.
 */
export function isAllowedIp(ip: string): boolean {
  const allowed = env.PAYME_ALLOWED_IPS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!allowed || allowed.length === 0) return true;
  // Normalize IPv4-mapped IPv6 (::ffff:1.2.3.4) — Node reports proxied v4 peers
  // in that form and a bare v4 entry in the allowlist would never match.
  const normalized = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  return allowed.includes(normalized) || allowed.includes(ip);
}
