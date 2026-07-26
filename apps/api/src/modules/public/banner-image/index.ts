import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { db } from '@db';
import { banners } from '@db/banners';
import { files } from '@db/files';
import { liveBanner } from '@lib/banner-visibility';
import { StringEnum } from '@lib/typebox';

const ERROR = { $ref: 'ErrorResponse#' };

// A year. Safe to cache this hard because the URL carries ?v=<fileId>: replacing
// a banner's art mints a new file id, hence a new URL, so a cached response can
// never be the stale one. (The param is not read here — it exists to vary the
// URL.) Note this outlives the liveness gate below by design: a device that
// already fetched the bytes keeps them, which only ever means a banner it has
// already been told to show renders instead of breaking.
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

// ---------------------------------------------------------------------------
// Banner artwork, served unauthenticated — the mobile app renders these into an
// Image widget, and requiring a session there buys nothing but complexity.
//
// Unlike merchant logos, this route is GATED ON LIVENESS: the bytes are only
// served while the banner is actually running. Banner ids are sequential and
// guessable, and a campaign scheduled for next month is exactly the kind of
// thing that should not be scrapeable before it is announced. Admins preview
// draft and retired art through presigned URLs on the admin routes instead.
// ---------------------------------------------------------------------------
export default async function publicBannerImageRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Public · Banners'];

  const Params = Type.Object({
    id: Type.String(),
    lang: StringEnum(['uz', 'ru'] as const),
  });

  fastify.get(
    '/public/banners/:id/image/:lang',
    {
      schema: {
        tags: TAGS,
        summary: 'Banner image',
        description:
          'The banner artwork for one language. 404s unless the banner is ' +
          'currently active and inside its window, so a scheduled campaign is ' +
          'not readable before it starts.',
        params: Params,
        // Binary image response; no JSON body schema (streams bypass serialization).
        response: { 404: ERROR },
      },
    },
    async (request, reply) => {
      const bannerId = Number(request.params.id);
      if (!Number.isInteger(bannerId)) return reply.code(404).sendError('banner_not_found');

      const [row] = await db
        .select({
          imageUzFileId: banners.imageUzFileId,
          imageRuFileId: banners.imageRuFileId,
        })
        .from(banners)
        .where(and(eq(banners.id, bannerId), liveBanner()))
        .limit(1);

      if (!row) return reply.code(404).sendError('banner_not_found');

      const fileId = request.params.lang === 'ru' ? row.imageRuFileId : row.imageUzFileId;
      const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
      if (!file) return reply.code(404).sendError('banner_not_found');

      const stream = await app.minio.getObject(file.bucket, file.objectKey);
      return reply
        .header('Content-Type', file.mimeType ?? 'application/octet-stream')
        .header('Content-Disposition', 'inline')
        .header('Cache-Control', CACHE_CONTROL)
        // Belt-and-braces: the upload path already proved these bytes are a real
        // image, but never let a browser sniff its way to another conclusion.
        .header('X-Content-Type-Options', 'nosniff')
        .send(stream);
    },
  );
}
