import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { adminUsers } from './admin-users';
import { files } from './files';

// ---------------------------------------------------------------------------
// banners — the promotional carousel on the client app's home screen.
//
// A banner is a FINISHED IMAGE, one per language, not a template the app fills
// in: the headline, the artwork and the CTA pill are all baked into the file a
// designer exports. That is why there is no title/subtitle/cta column here —
// the only text this table holds is `title`, which is an admin-side handle for
// the list page and never reaches a client. Copy changes are a re-export, and
// that trade was made deliberately (see the aspect-ratio rule below): it buys
// designs that can't be expressed as a text layout, and it means a long Russian
// headline can never overflow a box tuned for the Uzbek one.
//
// Both images are notNull, and rows are only created once both have been
// uploaded (same rule as public_offers), so no read path anywhere needs a
// "what if this locale has no art" branch.
//
// Unlike public_offers and app_version_policies, rows here are MUTABLE and
// there is no versioning: nothing legally binds a client to a banner. There is
// also no DELETE — removal is is_active = false. Keeping the row keeps
// view_count meaningful, keeps the files rows referenced (so no orphaned
// objects in storage), and leaves a record of what actually ran last quarter.
// ---------------------------------------------------------------------------

// What tapping a banner does. Append-only: an old app build that does not know
// a value MUST drop the banner from the carousel rather than render a CTA that
// swallows taps, which is what makes adding a value here a safe, backend-only
// change. `screen` (deep links into named app routes) is deliberately absent
// until the mobile router's names are pinned down — a whitelist we guessed at
// would fail silently on-device.
export const BANNER_ACTION_TYPES = ['none', 'external_url', 'merchant'] as const;
export type BannerActionType = (typeof BANNER_ACTION_TYPES)[number];

// Every banner image must be 2:1 (±2%) and at least 640px wide. Enforced at
// upload by lib/image-type#readImageSize, mirrored by a fixed-ratio box in the
// app, so the carousel never changes height mid-swipe and the dots never move
// under the user's thumb. Recommended export: 1440×720.
export const BANNER_ASPECT_RATIO = 2;
export const BANNER_ASPECT_TOLERANCE = 0.02;
export const MIN_BANNER_IMAGE_WIDTH = 300;

export const banners = pgTable(
  'banners',
  {
    id: serial('id').primaryKey(),
    // Admin-only handle ("Летняя акция 2026"). Never sent to a client — the
    // headline they see lives inside the image.
    title: text('title').notNull(),
    imageUzFileId: integer('image_uz_file_id')
      .references(() => files.id)
      .notNull(),
    imageRuFileId: integer('image_ru_file_id')
      .references(() => files.id)
      .notNull(),
    actionType: varchar('action_type', { length: 20 })
      .notNull()
      .default('none')
      .$type<BannerActionType>(),
    // The target, interpreted by actionType: an https URL, or a merchant id as
    // text. NULL exactly when actionType is 'none'. That pairing is enforced in
    // the write handler rather than by a CHECK, for the same reason
    // app_version_policies keeps its semver ordering there: the merchant branch
    // needs a lookup ("does merchant 42 exist and is it in the client catalog"),
    // which SQL alone cannot express as a column constraint.
    actionValue: text('action_value'),
    // The kill switch, hit by hand. Independent of the window below so pulling a
    // live banner is a toggle, not a retroactive edit of a date.
    isActive: boolean('is_active').notNull().default(true),
    // The campaign window, both optional: an evergreen banner sets neither.
    // NULL start means "already running", NULL end means "until switched off".
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    // Carousel position, ascending. Ties break on id DESC so a freshly created
    // banner (default 0) leads the ones already sitting at 0.
    sortOrder: integer('sort_order').notNull().default(0),
    // Impressions, counted raw by POST /client/banners/:id/view — no per-user
    // de-duplication, so this is "times a slide was shown", not "people who saw
    // it", and it compares banners that ran in the same carousel over the same
    // period rather than measuring anything absolute. A client can inflate their
    // own count; it is a steering signal, not a payout.
    //
    // It is also NOT a denominator for anything: nothing counts taps, so this
    // cannot yield a click-through rate. Reach only — "did this slide get in
    // front of anyone before it expired".
    viewCount: integer('view_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: integer('created_by').references(() => adminUsers.id),
  },
  // The client list's entire WHERE + ORDER BY. Every home-screen open runs it.
  (t) => [index('banners_active_sort_idx').on(t.isActive, t.sortOrder, t.id)],
);

export type Banner = typeof banners.$inferSelect;
