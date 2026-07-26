import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { BANNER_ACTION_TYPES } from '@db/banners';
import { buildBannerImageUrl } from '@lib/banner-image';
import { StringEnum } from '@lib/typebox';
import { resolveLang } from '../../../i18n/index';
import { countBannerView, listLiveBanners } from './queries';

// The promotional carousel on the home screen. A banner is a finished image —
// the headline and the CTA are baked into it — so this response carries no copy
// at all: one image URL, already resolved to the caller's language, plus what
// tapping it should do.
//
// The list is the same for every client (no targeting), which is why it can be
// cached client-side rather than recomputed per user on every app open.

const TAGS = ['Client · Banners'];
const SECURITY = [{ clientAuth: [] }];
const XLANG = [{ $ref: '#/components/parameters/xLang' }];
const ERROR = { $ref: 'ErrorResponse#' };

// Five minutes. The list only changes when an admin edits it, and the cost of
// staleness is bounded: a banner pulled right now can linger on a device that
// already fetched, for at most this long. `private` because the route is behind
// clientAuth and must never be held by a shared cache.
const CACHE_CONTROL = 'private, max-age=300';

const Banner = Type.Object(
  {
    id: Type.String(),
    // Absolute, and unique per uploaded file — see lib/banner-image. Always 2:1;
    // the app renders it into a fixed-ratio box so the carousel cannot change
    // height between slides.
    imageUrl: Type.String(),
    actionType: StringEnum(BANNER_ACTION_TYPES, {
      description:
        'What tapping the banner does. This list grows over time: a build that ' +
        'does not recognise a value MUST drop the banner from the carousel ' +
        'rather than render a CTA that does nothing when tapped.',
    }),
    // null exactly when actionType is 'none'.
    actionValue: Type.Union([Type.String(), Type.Null()]),
  },
  {
    examples: [
      {
        id: '12',
        imageUrl: 'https://api.example.com/api/v1/public/banners/12/image/uz?v=88',
        actionType: 'merchant',
        actionValue: '42',
      },
    ],
  },
);

export default async function clientBannerRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const guards = [app.verifyClientJwt];

  // Serial ids, matching the client convention (see client/merchants). The
  // pattern turns a junk path into a 400 rather than a NaN reaching the query.
  const IdParams = Type.Object({ id: Type.String({ pattern: '^\\d+$' }) });

  /* ── GET /client/banners — the carousel ─────────────────────────────────── */

  fastify.get(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'Home-screen banners',
        description:
          'Live banners in display order. An empty array means the app should ' +
          'hide the carousel entirely rather than show a placeholder. Banners ' +
          'whose image fails to load, or whose `actionType` this build does not ' +
          'know, must be dropped from the carousel — the rule is that a banner ' +
          'which cannot be rendered in full does not exist.',
        security: SECURITY,
        parameters: XLANG,
        response: { 200: Type.Object({ banners: Type.Array(Banner) }), 401: ERROR },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      const lang = resolveLang(request.headers['x-lang'] as string | undefined);

      // Vary is mandatory, not decorative: the uz and ru responses differ only by
      // this header, so without it a cache can hand a client the wrong language's
      // artwork. Same rule as the public app-version route.
      reply.header('Cache-Control', CACHE_CONTROL).header('Vary', 'x-lang');

      const rows = await listLiveBanners();

      return {
        banners: rows.map((row) => ({
          id: row.id.toString(),
          imageUrl: buildBannerImageUrl(
            row.id,
            lang,
            lang === 'ru' ? row.imageRuFileId : row.imageUzFileId,
          ),
          actionType: row.actionType,
          actionValue: row.actionValue,
        })),
      };
    },
  );

  /* ── POST /client/banners/:id/view — impression ping ────────────────────── */

  fastify.post(
    '/:id/view',
    {
      schema: {
        tags: TAGS,
        summary: 'Count a banner impression',
        description:
          'Call once per banner per session, when the slide actually becomes ' +
          'visible — not on every swipe, and not for slides the carousel has ' +
          'rendered but not shown. Fire-and-forget: always 204, whether or not ' +
          'the banner is still live, because an analytics ping must never turn ' +
          'into an error the user sees, and a 404 here would report which ids ' +
          'exist. Impressions are counted raw, with no per-user de-duplication.',
        security: SECURITY,
        parameters: XLANG,
        params: IdParams,
        // No 204 entry: an empty body has nothing to serialize, and declaring a
        // schema for it is how fastify ends up writing "null" into it.
        response: { 401: ERROR },
      },
      preHandler: guards,
    },
    async (request, reply) => {
      await countBannerView(Number(request.params.id));
      return reply.code(204).send();
    },
  );
}
