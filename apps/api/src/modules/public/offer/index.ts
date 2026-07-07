import { desc, eq } from 'drizzle-orm';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { db } from '@db';
import { files } from '@db/files';
import { publicOffers } from '@db/public-offers';

const ERROR = { $ref: 'ErrorResponse#' };

type Lang = 'uz' | 'ru';

// Current public offer = highest-version row (latest wins). Mirrors the read in
// client/registration/public-offers.ts; kept local so this public, unauthed
// surface doesn't depend on the client module.
async function getCurrentPublicOffer() {
  const [row] = await db.select().from(publicOffers).orderBy(desc(publicOffers.version)).limit(1);
  return row ?? null;
}

export default async function publicOfferRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();
  const TAGS = ['Public · Offer'];

  // Streams the current offer's PDF for the given language straight from object
  // storage, so the client never handles a presigned URL. 404 when no version
  // exists yet or the referenced file is missing.
  async function streamOffer(lang: Lang, reply: FastifyReply) {
    const offer = await getCurrentPublicOffer();
    if (!offer) return reply.code(404).sendError('public_offer_not_found');

    const fileId = lang === 'ru' ? offer.fileRuId : offer.fileUzId;
    const [file] = await db.select().from(files).where(eq(files.id, fileId)).limit(1);
    if (!file) return reply.code(404).sendError('public_offer_not_found');

    const stream = await app.minio.getObject(file.bucket, file.objectKey);
    return reply
      .header('Content-Type', file.mimeType ?? 'application/pdf')
      .header('Content-Disposition', `inline; filename="public-offer-${lang}.pdf"`)
      .send(stream);
  }

  const routeOpts = (summary: string) => ({
    schema: {
      tags: TAGS,
      summary,
      // Binary PDF response; no JSON body schema (streams bypass serialization).
      response: { 404: ERROR },
    },
  });

  // Default language is uz.
  fastify.get('/offer', routeOpts('Current public offer PDF (uz)'), (_req, reply) =>
    streamOffer('uz', reply),
  );
  fastify.get('/offer/uz', routeOpts('Current public offer PDF (uz)'), (_req, reply) =>
    streamOffer('uz', reply),
  );
  fastify.get('/offer/ru', routeOpts('Current public offer PDF (ru)'), (_req, reply) =>
    streamOffer('ru', reply),
  );
}
