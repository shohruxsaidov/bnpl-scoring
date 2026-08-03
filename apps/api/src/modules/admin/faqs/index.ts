import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@db';
import {
  FAQ_CATEGORIES,
  MAX_FAQ_ANSWER_LENGTH,
  MAX_FAQ_QUESTION_LENGTH,
  faqs,
  type FaqCategory,
} from '@db/faqs';
import { adminUsers } from '@db/admin-users';
import { StringEnum } from '@lib/typebox';

// ---------------------------------------------------------------------------
// Admin management of the client app's help screen.
//
// Unlike banners, this surface has a real DELETE: nothing references a faq row,
// it owns no storage objects and carries no counters, so a wrong answer can
// simply stop existing (see db/faqs.ts). `isActive: false` is the other,
// genuinely different operation — "correct, but not yet".
//
// The list route returns active AND inactive rows unconditionally. There is no
// includeInactive flag here because unlike the banner archive this list is the
// authoring surface: an admin looking for the answer they switched off last week
// should find it in front of them, not behind a checkbox.
// ---------------------------------------------------------------------------

export default async function adminFaqRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();

  const TAGS = ['Admin · FAQ'];
  const ERROR = { $ref: 'ErrorResponse#' };

  const IdParams = Type.Object({ id: Type.String({ pattern: '^\\d+$' }) });

  // `{ type: 'string', enum: […] }` rather than a union of literals, so Swagger UI
  // renders every value (see lib/typebox#StringEnum).
  //
  // The handlers below re-assert FaqCategory on the way in for the same reason
  // admin/banners does with its action type: the installed type provider cannot
  // read the static type off a Type.Unsafe, so this field alone arrives as
  // `unknown` however it is declared. ajv still validates it against this enum
  // before a handler runs.
  const Category = StringEnum(FAQ_CATEGORIES, {
    description:
      'Which section of the help screen this entry appears under. The client app ' +
      'owns the label and the order of the sections themselves.',
  });

  const Question = Type.String({ minLength: 1, maxLength: MAX_FAQ_QUESTION_LENGTH });
  // Plain text with newlines — see db/faqs.ts. Not markdown, not HTML; nothing
  // here is sanitized or rendered server-side because nothing is meant to be.
  const Answer = Type.String({ minLength: 1, maxLength: MAX_FAQ_ANSWER_LENGTH });

  const CreateBody = Type.Object({
    category: Category,
    questionUz: Question,
    questionRu: Question,
    answerUz: Answer,
    answerRu: Answer,
    isActive: Type.Optional(Type.Boolean()),
  });

  // Every field optional. `sortOrder` is deliberately absent from both bodies:
  // position is only ever set by /reorder, so there is no second way to write it
  // and therefore no way for the two to disagree.
  const UpdateBody = Type.Partial(CreateBody);

  const FaqView = Type.Object({
    id: Type.Integer(),
    category: Category,
    questionUz: Type.String(),
    questionRu: Type.String(),
    answerUz: Type.String(),
    answerRu: Type.String(),
    isActive: Type.Boolean(),
    sortOrder: Type.Integer(),
    createdAt: Type.String(),
    updatedAt: Type.String(),
    createdByName: Type.Union([Type.String(), Type.Null()]),
  });

  /* ── List ───────────────────────────────────────────────────────────────── */

  fastify.get(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'List FAQs',
        description:
          'Active and inactive together, grouped by category and ordered within ' +
          'each one. The whole list in one call — it is small by construction and ' +
          'the admin screen filters client-side.',
        response: { 200: Type.Object({ faqs: Type.Array(FaqView) }) },
      },
    },
    async () => {
      const rows = await db
        .select({ faq: faqs, createdByName: adminUsers.fullName })
        .from(faqs)
        .leftJoin(adminUsers, eq(faqs.createdBy, adminUsers.id))
        .orderBy(asc(faqs.category), asc(faqs.sortOrder), asc(faqs.id));

      return { faqs: rows.map(serialize) };
    },
  );

  /* ── Create ─────────────────────────────────────────────────────────────── */

  fastify.post(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'Create a FAQ',
        description:
          'All four texts are required — an entry is never half-translated, so ' +
          'the client read path never has to decide what to show a Russian ' +
          'speaker when only the Uzbek text exists. The new entry lands at the ' +
          'bottom of its category; use /reorder to move it.',
        body: CreateBody,
        response: { 201: Type.Object({ faq: FaqView }), 400: ERROR },
      },
    },
    async (request, reply) => {
      const body = request.body;
      // Narrowed, not trusted: ajv has already rejected anything outside the
      // enum — see Category.
      const category = body.category as FaqCategory;

      const text = normalizeText(body);
      if (!text) return reply.code(400).sendError('faq_text_required');

      const adminId = Number((request.user as { sub: string }).sub);

      // Appended rather than prepended: a new entry is usually a follow-up to the
      // ones already there, and silently pushing it above hand-ordered content
      // would undo an admin's earlier work every time they add a question.
      const [{ next } = { next: 0 }] = await db
        .select({ next: sql<number>`coalesce(max(${faqs.sortOrder}) + 1, 0)` })
        .from(faqs)
        .where(eq(faqs.category, category));

      const [row] = await db
        .insert(faqs)
        .values({
          category,
          ...text,
          isActive: body.isActive ?? true,
          sortOrder: Number(next),
          createdBy: adminId,
        })
        .returning();

      return reply.code(201).send({ faq: serialize({ faq: row!, createdByName: null }) });
    },
  );

  /* ── Update ─────────────────────────────────────────────────────────────── */

  fastify.patch(
    '/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Update a FAQ',
        description:
          'Any subset of fields. Moving an entry to another category puts it at ' +
          "the bottom of the destination — its old position was a rank among rows " +
          'it no longer sits with, so carrying it over would be meaningless.',
        params: IdParams,
        body: UpdateBody,
        response: { 200: Type.Object({ faq: FaqView }), 400: ERROR, 404: ERROR },
      },
    },
    async (request, reply) => {
      const id = Number(request.params.id);
      const existing = await findFaq(id);
      if (!existing) return reply.code(404).sendError('faq_not_found');

      const body = request.body;
      const category = (body.category as FaqCategory | undefined) ?? existing.faq.category;

      // Validated against the state the row will be in, not just what was sent —
      // a PATCH that blanks one language must fail even though the other three
      // were never touched.
      const text = normalizeText({
        questionUz: body.questionUz ?? existing.faq.questionUz,
        questionRu: body.questionRu ?? existing.faq.questionRu,
        answerUz: body.answerUz ?? existing.faq.answerUz,
        answerRu: body.answerRu ?? existing.faq.answerRu,
      });
      if (!text) return reply.code(400).sendError('faq_text_required');

      // Only when the category actually changes: an ordinary edit must not move
      // the entry the admin was editing.
      const sortOrder =
        category === existing.faq.category
          ? undefined
          : Number(
              (
                await db
                  .select({ next: sql<number>`coalesce(max(${faqs.sortOrder}) + 1, 0)` })
                  .from(faqs)
                  .where(eq(faqs.category, category))
              )[0]?.next ?? 0,
            );

      const [row] = await db
        .update(faqs)
        .set({
          category,
          ...text,
          ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          ...(sortOrder !== undefined ? { sortOrder } : {}),
          updatedAt: new Date(),
        })
        .where(eq(faqs.id, id))
        .returning();

      return { faq: serialize({ faq: row!, createdByName: existing.createdByName }) };
    },
  );

  /* ── Delete ─────────────────────────────────────────────────────────────── */

  fastify.delete(
    '/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Delete a FAQ',
        description:
          'Permanent. Use this when an answer is WRONG or its feature is gone; ' +
          'to hide a correct answer temporarily, PATCH `isActive: false` instead. ' +
          'Safe to delete because nothing references a FAQ — but a client whose ' +
          'list is still cached keeps showing it for up to five minutes.',
        params: IdParams,
        response: { 204: Type.Null(), 404: ERROR },
      },
    },
    async (request, reply) => {
      const id = Number(request.params.id);
      // The gap left behind is not closed: sort_order only has to be monotonic
      // within a category, not contiguous, and the next /reorder normalises it.
      const deleted = await db.delete(faqs).where(eq(faqs.id, id)).returning({ id: faqs.id });
      if (deleted.length === 0) return reply.code(404).sendError('faq_not_found');
      return reply.code(204).send(null);
    },
  );

  /* ── Reorder ────────────────────────────────────────────────────────────── */

  fastify.patch(
    '/reorder',
    {
      schema: {
        tags: TAGS,
        summary: 'Reorder one category',
        description:
          "`ids` must be the COMPLETE set of that category's entries, in the order " +
          'they should appear. A partial or stale list is rejected rather than ' +
          'applied: if someone else added a question while this screen was open, ' +
          'silently ordering around it would leave the two admins looking at ' +
          'different lists. Scoped to one category, so reordering two sections at ' +
          'once cannot conflict.',
        body: Type.Object({
          category: Category,
          ids: Type.Array(Type.Integer(), { minItems: 1 }),
        }),
        response: { 200: Type.Object({ faqs: Type.Array(FaqView) }), 400: ERROR },
      },
    },
    async (request, reply) => {
      const category = request.body.category as FaqCategory;
      const ids = request.body.ids;

      // Duplicates would make the CASE below ambiguous and mean the caller's list
      // was never a valid ordering in the first place.
      if (new Set(ids).size !== ids.length) return reply.code(400).sendError('faq_reorder_mismatch');

      const current = await db
        .select({ id: faqs.id })
        .from(faqs)
        .where(eq(faqs.category, category));

      const currentIds = new Set(current.map((r) => r.id));
      if (currentIds.size !== ids.length || ids.some((id) => !currentIds.has(id))) {
        return reply.code(400).sendError('faq_reorder_mismatch');
      }

      // One statement, not a loop: the whole section is renumbered 0..n-1 or none
      // of it is, so there is no window in which a concurrent read sees half an
      // ordering.
      //
      // The new positions are inlined with sql.raw rather than bound as
      // parameters, and that is load-bearing: every branch of a CASE whose THENs
      // are all untyped placeholders resolves to `text`, which Postgres then
      // refuses to assign to an integer column. They are array indices this
      // handler generated, never caller input, so there is nothing to inject.
      // The ids being compared stay parameterised — those DO come from the body.
      await db
        .update(faqs)
        .set({
          sortOrder: sql`case ${sql.join(
            ids.map((id, index) => sql`when ${faqs.id} = ${id} then ${sql.raw(String(index))}`),
            sql` `,
          )} end`,
          updatedAt: new Date(),
        })
        .where(and(eq(faqs.category, category), inArray(faqs.id, ids)));

      const rows = await db
        .select({ faq: faqs, createdByName: adminUsers.fullName })
        .from(faqs)
        .leftJoin(adminUsers, eq(faqs.createdBy, adminUsers.id))
        .where(eq(faqs.category, category))
        .orderBy(asc(faqs.sortOrder), asc(faqs.id));

      return { faqs: rows.map(serialize) };
    },
  );

  /* ── helpers ────────────────────────────────────────────────────────────── */

  async function findFaq(id: number) {
    const [row] = await db
      .select({ faq: faqs, createdByName: adminUsers.fullName })
      .from(faqs)
      .leftJoin(adminUsers, eq(faqs.createdBy, adminUsers.id))
      .where(eq(faqs.id, id))
      .limit(1);
    return row;
  }

  // ajv's minLength counts characters, so a field of four spaces passes it and
  // would reach a client as a blank accordion row. Trimming is the check.
  function normalizeText(input: {
    questionUz: string;
    questionRu: string;
    answerUz: string;
    answerRu: string;
  }) {
    const trimmed = {
      questionUz: input.questionUz.trim(),
      questionRu: input.questionRu.trim(),
      answerUz: input.answerUz.trim(),
      answerRu: input.answerRu.trim(),
    };
    return Object.values(trimmed).every((v) => v.length > 0) ? trimmed : null;
  }

  function serialize({
    faq,
    createdByName,
  }: {
    faq: typeof faqs.$inferSelect;
    createdByName: string | null;
  }) {
    return {
      id: faq.id,
      category: faq.category,
      questionUz: faq.questionUz,
      questionRu: faq.questionRu,
      answerUz: faq.answerUz,
      answerRu: faq.answerRu,
      isActive: faq.isActive,
      sortOrder: faq.sortOrder,
      createdAt: faq.createdAt.toISOString(),
      updatedAt: faq.updatedAt.toISOString(),
      createdByName: createdByName ?? null,
    };
  }
}
