import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { env } from '../env';

// Firebase Cloud Messaging singleton. Initialized lazily at import from the
// base64 service-account JSON in FIREBASE_SERVICE_ACCOUNT_BASE64. When the var
// is unset (local/dev/test) or malformed, `messaging` stays null and the push
// worker soft-degrades — inbox rows are still written; only the push is skipped.
// A missing/broken push provider must never crash the scoring pipeline.
function init(): Messaging | null {
  const raw = env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!raw) return null;
  try {
    const json = JSON.parse(Buffer.from(raw, 'base64').toString('utf8'));
    const app: App = getApps().length ? getApps()[0]! : initializeApp({ credential: cert(json) });
    return getMessaging(app);
  } catch (err) {
    // Soft-degrade on misconfiguration rather than fail boot.
    console.warn('[firebase] failed to init messaging — push disabled', err);
    return null;
  }
}

export const messaging: Messaging | null = init();
