import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { db } from '@db';
import { files } from '@db/files';
import { merchants } from '@db/schema';

const ERROR = { $ref: 'ErrorResponse#' };

// A year. Safe to cache this hard because the URL carries ?v=<logoFileId>:
// replacing a logo mints a new file id, hence a new URL, so a cached response can
// never be the stale one. (The param is not read here — it exists to vary the URL.)
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

// ---------------------------------------------------------------------------
// Merchant logos, served unauthenticated. Consumed by the admin portal and by the
// mobile app, which renders them on deal cards and has no session when it does.
// Streamed from object storage rather than redirected to a presigned URL, so
// storage never has to be internet-reachable.
//
// Keyed by the merchant's serial id, which lets anyone enumerate which merchants
// exist and which have a logo. That is a deliberate trade: a logo is a public
// brand mark that every borrower already sees on their deal.
// ---------------------------------------------------------------------------
export default async function publicMerchantLogoRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Public · Merchants'];

  const Params = Type.Object({ objectKey: Type.String() });

  fastify.get(
    '/public/user-photo/:objectKey',
    {
      schema: {
        tags: TAGS,
        summary: 'User photo',
        params: Params,
        // Binary image response; no JSON body schema (streams bypass serialization).
        response: { 404: ERROR },
      },
    },
    async (request, reply) => {
      const objectKey = request.params.objectKey
     


      const [file] = await db.select().from(files).where(eq(files.objectKey, objectKey)).limit(1);
      if (!file) return reply.code(404).sendError('merchant_logo_not_found');

      const stream = await app.minio.getObject(file.bucket, file.objectKey);
      return (
        reply
          .header('Content-Type', file.mimeType ?? 'application/octet-stream')
          .header('Content-Disposition', 'inline')
          .header('Cache-Control', CACHE_CONTROL)
          // Belt-and-braces: the upload path already proved these bytes are a real
          // image, but never let a browser sniff its way to another conclusion.
          .header('X-Content-Type-Options', 'nosniff')
          .send(stream)
      );
    },
  );
}
