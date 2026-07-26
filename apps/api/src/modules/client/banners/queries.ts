import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '@db';
import { banners } from '@db/banners';
import { liveBanner } from '@lib/banner-visibility';
import { filterVisibleMerchantIds } from '../merchants/queries';

// The carousel is a handful of slides, not a feed: nobody swipes past a few, and
// an unbounded list would let one enthusiastic month of campaigns turn the home
// screen's first paint into a large response. Anything beyond this is simply not
// served — the admin UI warns well before the cap is reached.
const MAX_BANNERS = 10;

/**
 * Live banners for the carousel, in display order, already stripped of any whose
 * tap target has gone away.
 *
 * Identical for every client — there is no targeting — which is what makes the
 * response cacheable and keeps this to a single indexed scan plus, at most, one
 * id lookup.
 */
export async function listLiveBanners() {
  const rows = await db
    .select({
      id: banners.id,
      imageUzFileId: banners.imageUzFileId,
      imageRuFileId: banners.imageRuFileId,
      actionType: banners.actionType,
      actionValue: banners.actionValue,
    })
    .from(banners)
    .where(liveBanner())
    // id DESC breaks ties so a newly created banner (sort_order defaults to 0)
    // leads the ones already sitting at 0, and so paging is deterministic.
    .orderBy(asc(banners.sortOrder), desc(banners.id))
    .limit(MAX_BANNERS);

  // A merchant that was in the catalog when the banner was created can be
  // deactivated, hidden, or lose its last active branch later; the write-time
  // check cannot see the future. Dropping the banner is the honest outcome —
  // the alternative is a CTA that opens an empty screen.
  const merchantIds = rows
    .filter((r) => r.actionType === 'merchant' && r.actionValue != null)
    .map((r) => Number(r.actionValue));

  const visible = await filterVisibleMerchantIds(merchantIds);

  return rows.filter(
    (r) => r.actionType !== 'merchant' || visible.has(Number(r.actionValue)),
  );
}

/**
 * Counts an impression. Returns nothing — the caller answers 204 either way.
 *
 * Gated on liveness so a retired banner's number stops moving the moment it
 * stops running; otherwise "is this campaign still earning its slot" would not
 * be answerable from the data. A view of a banner pulled seconds ago is simply
 * lost, which is the correct side of that trade.
 *
 * This runs far more often than a tap-counter would — every carousel that comes
 * into sight — which is why it stays a single unindexed increment with no row
 * written anywhere. The app is expected to ping once per banner per session
 * rather than on every swipe back and forth.
 */
export async function countBannerView(bannerId: number): Promise<void> {
  await db
    .update(banners)
    .set({ viewCount: sql`${banners.viewCount} + 1` })
    .where(and(eq(banners.id, bannerId), liveBanner()));
}
