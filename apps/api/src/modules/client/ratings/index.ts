import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { getUserRating, upsertUserRating } from './queries';

// How a client rates the mobile app itself. One rating per user, upserted — the
// value is the client's current opinion, so re-rating replaces it and no history
// is kept (see db/app-ratings.ts).
//
// A user reads and writes only their own rating; userId comes from the JWT and
// is never accepted from the body, so there is no id to authorize against.

const TAGS = ['Client · Ratings'];
const SECURITY = [{ clientAuth: [] }];
const XLANG = [{ $ref: '#/components/parameters/xLang' }];
const ERROR = { $ref: 'ErrorResponse#' };

const MIN_RATING = 1;
const MAX_RATING = 5;

// The 1..5 range lives here and only here — the column is a bare smallint. A 0
// or a 6 becomes a 400 before it can reach the table.
const RatingValue = Type.Integer({
  minimum: MIN_RATING,
  maximum: MAX_RATING,
  examples: [5],
});

export default async function clientRatingRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const guards = [app.verifyClientJwt];

  /* ── GET /client/ratings — this user's rating, if any ───────────────────── */

  fastify.get(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'Get my app rating',
        description:
          "The caller's own rating, or `null` if they have never rated. Lets " +
          'the app decide between showing a "rate us" prompt and showing the ' +
          'current stars. Never rating is a normal state, so this is a 200 with ' +
          'a null rating rather than a 404.',
        security: SECURITY,
        parameters: XLANG,
        response: {
          200: Type.Object({
            rating: Type.Union([RatingValue, Type.Null()]),
          }),
          401: ERROR,
        },
      },
      preHandler: guards,
    },
    async (request) => {
      // users.id is a serial; JWT sub is a string.
      const row = await getUserRating(Number(request.user.sub));
      return { rating: row?.rating ?? null };
    },
  );

  /* ── POST /client/ratings — rate the app ────────────────────────────────── */

  fastify.post(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'Rate the app',
        description:
          'Stores the 1..5 rating for the caller, replacing any previous one. ' +
          'Idempotent: safe to retry on a flaky connection, and rating again is ' +
          'a normal update rather than an error.',
        security: SECURITY,
        parameters: XLANG,
        body: Type.Object({ rating: RatingValue }),
        response: {
          200: Type.Object({ rating: RatingValue }),
          400: ERROR,
          401: ERROR,
        },
      },
      preHandler: guards,
    },
    async (request) => {
      const { rating } = request.body;
      await upsertUserRating(Number(request.user.sub), rating);
      // Echo the stored value so the app can render from the response instead of
      // re-reading.
      return { rating };
    },
  );
}
