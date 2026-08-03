import { asc, eq } from 'drizzle-orm';
import { db } from '@db';
import { faqs } from '@db/faqs';

// The help screen is a hand-written list, not a feed: an admin who has written
// past this many has a documentation site, not an FAQ. The cap exists so a
// runaway list cannot turn one screen open into a large response — it is not a
// page boundary, and there is deliberately no way to fetch the rest.
const MAX_FAQS = 200;

/**
 * Every live FAQ, ordered within each category.
 *
 * Identical for every client — there is no targeting and nothing here depends on
 * the caller — which is what makes the response cacheable and keeps this to a
 * single indexed scan.
 *
 * Ordered by category then sortOrder purely so rows of the same section arrive
 * together; the app groups them itself and renders the SECTIONS in its own order,
 * since it is the side that owns their labels. Sorting by the category *string*
 * here would therefore be alphabetical noise the app ignores — it is grouped, not
 * ranked. sortOrder is what actually matters, and it only means anything within
 * one category.
 */
export async function listActiveFaqs() {
  return db
    .select({
      id: faqs.id,
      category: faqs.category,
      questionUz: faqs.questionUz,
      questionRu: faqs.questionRu,
      answerUz: faqs.answerUz,
      answerRu: faqs.answerRu,
    })
    .from(faqs)
    .where(eq(faqs.isActive, true))
    .orderBy(asc(faqs.category), asc(faqs.sortOrder), asc(faqs.id))
    .limit(MAX_FAQS);
}
