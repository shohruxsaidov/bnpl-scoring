import type { NotificationType } from '@db/notifications';
import { translate, type SupportedLang } from '../../../i18n/index';

// ---------------------------------------------------------------------------
// Notification text rendering — the ONE place a notification row becomes human
// text. Consumed by the inbox list (GET /client/notifications), the FCM push
// worker, and the admin-facing mirror, so the three can never drift.
//
// Rows stay data-driven in the database (`type` + `data`); the localized text is
// built on read, per request language. Nothing is stored pre-rendered — a client
// who switches the app to Uzbek sees their whole inbox flip on the next fetch,
// including rows created while they were on Russian.
// ---------------------------------------------------------------------------

export interface NotificationText {
  title: string;
  body: string;
}

// `custom` rows carry admin-authored text in `data` instead of an i18n key. The
// admin send-push route requires all four fields, but this is not the only way a
// row can reach here — so fall back across languages rather than letting an
// `undefined` title through, which would render literally as "undefined".
function pickText(
  data: Record<string, unknown>,
  lang: SupportedLang,
  field: 'title' | 'body',
): string {
  const suffixed = lang === 'uz' ? `${field}Uz` : `${field}Ru`;
  const candidates = [data[suffixed], data[`${field}Ru`], data[`${field}Uz`]];
  return (
    (candidates.find((v) => typeof v === 'string' && v.trim() !== '') as string | undefined) ?? ''
  );
}

/**
 * True when `translate` gave back something that is not human text: either the
 * i18n key itself (no dictionary entry in either language) or a template with an
 * unfilled `%{placeholder}` (the row's `data` is missing a render param).
 *
 * Both are silent bugs in a push — it flashes past once — but DURABLE in the
 * inbox: the row sits in the list forever, re-rendering wrong on every fetch.
 * We still return the degraded string (a visible-but-harmless notification beats
 * a vanished one that keeps counting toward the unread badge), and log so the
 * missing key or param gets fixed.
 */
function isUnrendered(value: string, code: string): boolean {
  return value === code || /%\{\w+\}/.test(value);
}

/**
 * Render one notification's title/body in `lang`.
 *
 * `warn` is called with a reason when the result is degraded; callers pass their
 * logger. Never throws — notification text must not be able to fail a request or
 * a queue job.
 */
export function renderNotificationText(
  type: NotificationType,
  lang: SupportedLang,
  data: Record<string, unknown>,
  warn?: (reason: string) => void,
): NotificationText {
  if (type === 'custom') {
    const title = pickText(data, lang, 'title');
    const body = pickText(data, lang, 'body');
    if (!title || !body) warn?.('custom notification missing authored text');
    return { title, body };
  }

  const titleCode = `notification.${type}.title`;
  const bodyCode = `notification.${type}.body`;
  const title = translate(lang, titleCode, data);
  const body = translate(lang, bodyCode, data);

  if (isUnrendered(title, titleCode) || isUnrendered(body, bodyCode)) {
    warn?.(`missing i18n key or render param for notification type "${type}" (${lang})`);
  }

  return { title, body };
}
