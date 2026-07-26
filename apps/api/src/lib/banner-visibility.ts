import { and, eq, gt, isNull, lte, or, sql } from 'drizzle-orm';
import { banners } from '@db/banners';

// THE liveness predicate for banners. Three surfaces must agree on it — the
// client list, the click counter, and the public image route — and they are in
// three different modules, which is why it lives in lib rather than beside any
// one of them. If the list and the image route ever disagreed, a banner would
// render as a broken slide instead of not rendering at all.
//
// `now()` is the database's clock on purpose: the window is stored with a
// timezone and compared server-side, so a device with a wrong clock cannot pull
// a campaign forward.
export function liveBanner() {
  return and(
    eq(banners.isActive, true),
    or(isNull(banners.startsAt), lte(banners.startsAt, sql`now()`)),
    // Exclusive end: a banner with endsAt = 12:00 is gone AT 12:00, matching how
    // an admin reads "runs until noon".
    or(isNull(banners.endsAt), gt(banners.endsAt, sql`now()`)),
  );
}
