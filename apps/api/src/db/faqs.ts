import { boolean, index, integer, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { adminUsers } from './admin-users';

// ---------------------------------------------------------------------------
// faqs — the help screen in the client app. One row is one question with its
// answer, written by hand in both languages by whoever holds `manage_faqs`.
//
// Unlike banners and public_offers — the two other admin-authored, client-facing
// surfaces — rows here are DELETABLE, not just deactivatable. Every reason those
// two forbid a hard delete is absent: there is no view counter whose meaning a
// deleted row would take with it, no `files` row that would be left pointing at
// an orphaned object in storage, and nothing anywhere holds a foreign key into
// this table. A wrong answer should stop existing, and the list is also the
// authoring surface, so letting typo'd drafts silt up in it makes the tool
// worse. `isActive = false` still exists and means something different:
// "correct, but not right now" — an answer about a feature that ships next month.
//
// All four text columns are notNull, the same rule banners applies to its two
// images: a row is only written once both languages are ready, so no read path
// ever branches on a missing locale and a Russian speaker is never quietly
// served Uzbek text. There is no draft state; content arrives as a pair.
// ---------------------------------------------------------------------------

// The sections the help screen is grouped into. Append-only, and deliberately
// KEYS rather than text: the client app holds the label for each one in its own
// i18n bundle, exactly as it does for notification types.
//
// Because the app owns the labels, it also owns the section ORDER — these render
// top to bottom in the app's own list, not in whatever order rows come back.
// Reordering sections is therefore a mobile release; reordering entries within a
// section is not (see sortOrder below).
//
// Adding a value here is a safe, backend-only change: unlike BANNER_ACTION_TYPES,
// a build that does not recognise a category MUST NOT drop the entry. It renders
// it under a generic "other" bucket instead. A banner whose CTA does nothing is
// worse than no banner, but an FAQ answer is self-contained — the section header
// being wrong costs the reader nothing, while hiding "why was my limit lowered"
// costs them a support call, which is the one thing this table exists to prevent.
export const FAQ_CATEGORIES = [
  'general', // what this service is, who can use it
  'limits', // scoring, why a limit changed, the advisory cap
  'payments', // card payments, schedules, late fees
  'deals', // active credits, signing, buyout
  'account', // profile, PIN, biometrics, devices
] as const;
export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

// Enforced by the write handlers, not by CHECK constraints — same reasoning as
// everywhere else in this schema: the limits exist to keep an accordion row
// readable on a phone, which is a UI judgement, not a data-integrity one.
export const MAX_FAQ_QUESTION_LENGTH = 300;
export const MAX_FAQ_ANSWER_LENGTH = 4000;

export const faqs = pgTable(
  'faqs',
  {
    id: serial('id').primaryKey(),
    category: varchar('category', { length: 40 }).notNull().$type<FaqCategory>(),
    questionUz: text('question_uz').notNull(),
    questionRu: text('question_ru').notNull(),
    // PLAIN TEXT, newlines only — not markdown and not HTML. The app must render
    // this with a plain text widget: a markdown renderer would silently italicise
    // a stray asterisk an admin typed as a bullet. The cost of that choice is
    // that an answer cannot contain a tappable link, which was accepted knowingly.
    answerUz: text('answer_uz').notNull(),
    answerRu: text('answer_ru').notNull(),
    // The kill switch. False hides the entry from clients while keeping it here
    // to be switched back on; DELETE is what "this was wrong" looks like.
    isActive: boolean('is_active').notNull().default(true),
    // Position WITHIN a category, ascending — never a global rank, because the
    // app decides the order of the sections themselves. Assigned in bulk by
    // PATCH /admin/faqs/reorder, which rewrites one category's rows to 0..n-1;
    // that is also why two admins reordering different sections cannot clobber
    // each other. Ties break on id ASC so a row created before the first drag
    // (default 0) still lands somewhere deterministic.
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdBy: integer('created_by').references(() => adminUsers.id),
  },
  // The client list's entire WHERE + ORDER BY, and the admin list's ordering too.
  (t) => [index('faqs_active_category_sort_idx').on(t.isActive, t.category, t.sortOrder, t.id)],
);

export type Faq = typeof faqs.$inferSelect;
