import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { FAQ_CATEGORIES } from '@db/faqs';
import { StringEnum } from '@lib/typebox';
import { resolveLang } from '../../../i18n/index';
import { listActiveFaqs } from './queries';

// The help screen. A flat list of question/answer pairs, already resolved to the
// caller's language, tagged with the section each belongs to. The app groups by
// `category` and renders the sections in its own order, using its own labels —
// nothing about how this looks is decided here.

const TAGS = ['Client · FAQ'];
const SECURITY = [{ clientAuth: [] }];
const ERROR = { $ref: 'ErrorResponse#' };

// Documented through `schema.headers`, NOT through the components/parameters
// $ref the other client modules use: @fastify/swagger derives a route's
// `parameters` from querystring/params/headers and drops a raw `parameters` key
// on the floor, so those refs render nothing at all (see banners, merchants).
//
// additionalProperties is left open — the default — because this validates every
// request to the route: locking it down would reject Authorization, x-device-id
// and everything else the client legitimately sends. Values outside the enum are
// rejected by ajv with a 400 rather than silently falling back to uz, which is
// stricter than resolveLang() alone and is the point of declaring it here.
const Headers = Type.Object({
  'x-lang': Type.Optional(
    StringEnum(['uz', 'ru'] as const, {
      description: 'Response language. Defaults to uz when omitted.',
    }),
  ),
});

// Five minutes, matching the banner carousel: the list only changes when an
// admin edits it, and the cost of staleness is bounded — a corrected answer can
// linger on a device that already fetched, for at most this long. `private`
// because the route is behind clientAuth and must never be held by a shared
// cache.
const CACHE_CONTROL = 'private, max-age=300';

const Faq = Type.Object(
  {
    id: Type.String(),
    category: StringEnum(FAQ_CATEGORIES, {
      description:
        'The section this entry belongs to. This list grows over time: a build ' +
        'that does not recognise a value MUST render the entry under a generic ' +
        '"other" section rather than drop it. An answer is worth reading even ' +
        'under the wrong heading.',
    }),
    question: Type.String(),
    // Plain text with newlines. NOT markdown and NOT HTML — render with a plain
    // text widget, or a stray asterisk in an admin's bullet list turns into
    // italics on every phone.
    answer: Type.String(),
  },
  {
    examples: [
      {
        id: '12',
        category: 'payments',
        question: "To'lovni qanday amalga oshiraman?",
        answer: "Ilovadagi «To'lov» bo'limiga kiring va kartani tanlang.",
      },
    ],
  },
);

export default async function clientFaqRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();

  /* ── GET /client/faqs — the help screen ─────────────────────────────────── */

  fastify.get(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'Frequently asked questions',
        description:
          'Every active FAQ, in one call — there is no paging and no search ' +
          'endpoint, because the whole list is small enough to filter on the ' +
          'device. Entries of the same `category` arrive together; the app is ' +
          'responsible for grouping them, for the section headings, and for the ' +
          'order the sections appear in. An empty array means the help screen ' +
          'should be hidden rather than shown empty.',
        security: SECURITY,
        headers: Headers,
        response: { 200: Type.Object({ faqs: Type.Array(Faq) }), 401: ERROR },
      },
      preHandler: [app.verifyClientJwt],
    },
    async (request, reply) => {
      const lang = resolveLang(request.headers['x-lang'] as string | undefined);

      // Vary is mandatory, not decorative: the uz and ru responses differ only by
      // this header, so without it a cache can hand a client the wrong language's
      // answers. Same rule as the banner carousel.
      reply.header('Cache-Control', CACHE_CONTROL).header('Vary', 'x-lang');

      const rows = await listActiveFaqs();

      return {
        faqs: rows.map((row) => ({
          id: row.id.toString(),
          category: row.category,
          // No null branch: both languages are notNull on the table precisely so
          // this stays a ternary rather than a fallback chain.
          question: lang === 'ru' ? row.questionRu : row.questionUz,
          answer: lang === 'ru' ? row.answerRu : row.answerUz,
        })),
      };
    },
  );
}
