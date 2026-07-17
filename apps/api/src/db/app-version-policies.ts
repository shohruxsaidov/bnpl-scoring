import { integer, pgTable, serial, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { adminUsers } from './admin-users';

// ---------------------------------------------------------------------------
// app_version_policies — the force-update policy for the mobile app, one row
// per platform per revision. The current policy for a platform is its row with
// the highest `version`; versions are assigned in-app as MAX(version)+1 SCOPED
// PER PLATFORM, and go live on insert (no draft flag). Rows are append-only
// and immutable: this is the switch that can lock every user out of the app at
// once, so "who moved the floor to 1.4.0, when, and what was it before" must
// stay answerable after the fact.
//
// Rows are per-platform rather than a both-platform snapshot because iOS and
// Android are independent products with independent release cadences and store
// review — iOS at 1.4.0 while Android is at 1.6.2 is normal, not a mismatch.
// A snapshot row would force every iOS edit to restate Android's policy
// verbatim, and the day someone copies a stale value forward it would brick a
// platform nobody was editing.
//
// Two thresholds, compared against the caller's version by lib/semver:
//   version <  minSupportedVersion  -> 'force' (app must block; non-dismissible)
//   version <  latestVersion        -> 'soft'  (dismissible update nudge)
//   otherwise                       -> 'ok'
// The soft lever exists so the hard one stops being the only instrument for
// driving adoption. Note `latestVersion` must be bumped every release or the
// nudge silently stops firing; `minSupportedVersion` is meant to be sticky.
//
// minSupportedVersion <= latestVersion is enforced in the write handler, NOT as
// a CHECK: semver ordering is not expressible in SQL without the comparator in
// lib/semver ('1.10.0' > '1.9.0' is false to Postgres).
//
// NO ROW FOR A PLATFORM MEANS 'ok', never 'force' — same rule as
// scoring_pipeline_settings ("absence means default"). It needs no seed
// migration, and a fresh database can never brick a fleet.
//
// messageUz/messageRu are notNull because this copy is rendered full-screen to
// clients running code we have already decided is too old to trust: if it is
// wrong or blank, the only fix is the update the user cannot install. Same
// reason storeUrl is server-supplied rather than hardcoded in the bundle.
//
// Reach is narrower than it looks: builds shipped before the app had a version
// check never call the endpoint and are ungateable by this table. The first
// build carrying the check is the effective floor forever.
// ---------------------------------------------------------------------------
export const appVersionPolicies = pgTable(
  'app_version_policies',
  {
    id: serial('id').primaryKey(),
    platform: varchar('platform', { length: 10 }).notNull().$type<'ios' | 'android'>(),
    version: integer('version').notNull(),
    // MAJOR.MINOR.PATCH, validated by lib/semver at every boundary. varchar(20)
    // holds the longest string that parser accepts ('9999.9999.9999').
    minSupportedVersion: varchar('min_supported_version', { length: 20 }).notNull(),
    latestVersion: varchar('latest_version', { length: 20 }).notNull(),
    // Where a stranded user is sent to update. Server-supplied so a changed
    // package name or distribution channel is a row insert, not a build.
    storeUrl: text('store_url').notNull(),
    // Shown full-screen on 'force' and in the nudge on 'soft'. Picked by the
    // x-lang header with a cross-language fallback, mirroring pickText() in
    // client/notifications/push.ts, so `undefined` never renders on-device.
    messageUz: text('message_uz').notNull(),
    messageRu: text('message_ru').notNull(),
    // Admin-only bookkeeping note (e.g. "raised floor for the OTP hotfix").
    // Never shown to clients.
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: integer('created_by').references(() => adminUsers.id),
  },
  // Also the concurrency guard: two admins publishing at once collide on the
  // constraint rather than silently sharing a version number.
  (t) => [uniqueIndex('app_version_policies_platform_version_idx').on(t.platform, t.version)],
);
