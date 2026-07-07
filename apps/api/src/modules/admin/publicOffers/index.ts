import { randomUUID } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import fastifyMultipart from '@fastify/multipart';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@db';
import { env } from '@env';
import { publicOffers } from '@db/public-offers';
import { adminUsers } from '@db/admin-users';
import { recordFile, getDownloadUrl } from '../../../lib/file-storage';

// ---------------------------------------------------------------------------
// Admin management of the versioned, PDF-based public offer. Read + create
// only: versions are append-only and immutable (a version a client accepted
// must never change), so there is no update or delete. A new version goes live
// on insert and is only created once both PDFs (uz + ru) have been uploaded.
// ---------------------------------------------------------------------------

const UPLOAD_PREFIX = 'public-offers';
const MAX_PDF_BYTES = 15 * 1024 * 1024; // 15 MB

export default async function adminPublicOfferRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();

  // Scoped to this plugin: only the offer-upload route consumes multipart, so
  // the rest of the admin API keeps its JSON-only body parsing.
  await app.register(fastifyMultipart, {
    limits: { fileSize: MAX_PDF_BYTES, files: 1 },
    // Don't throw on oversize; flag `file.truncated` so we can reject with a
    // localized 400 (file_too_large) instead of an opaque 413.
    throwFileSizeLimit: false,
  });

  const TAGS = ['Admin · Public Offer'];

  const UploadResponse = Type.Object(
    { objectKey: Type.String(), originalName: Type.Union([Type.String(), Type.Null()]) },
    { examples: [{ objectKey: 'public-offers/uuid', originalName: 'oferta-uz.pdf' }] },
  );

  const FileInput = Type.Object({
    objectKey: Type.String({ minLength: 1 }),
    originalName: Type.Optional(Type.String({ maxLength: 255 })),
  });

  const CreateBody = Type.Object({
    label: Type.Optional(Type.String({ maxLength: 500 })),
    fileUz: FileInput,
    fileRu: FileInput,
  });

  const OfferVersion = Type.Object({
    id: Type.Integer(),
    version: Type.Integer(),
    label: Type.Union([Type.String(), Type.Null()]),
    createdAt: Type.String(),
    createdByName: Type.Union([Type.String(), Type.Null()]),
    downloadUrlUz: Type.String(),
    downloadUrlRu: Type.String(),
  });

  /* ── Direct PDF upload (called once per PDF; streams through the backend) ── */

  fastify.post(
    '/upload-url',
    {
      schema: {
        tags: TAGS,
        summary: 'Upload a public-offer PDF to storage',
        description:
          'Accepts a single multipart PDF file, stores it in object storage, and ' +
          'returns its objectKey to reference when publishing a version.',
        consumes: ['multipart/form-data'],
        response: { 200: UploadResponse, 400: { $ref: 'ErrorResponse#' } },
      },
    },
    async (request, reply) => {
      const upload = await request.file();
      if (!upload) return reply.code(400).sendError('file_required');

      if (upload.mimetype !== 'application/pdf') {
        return reply.code(400).sendError('invalid_file_type');
      }

      // Buffer the whole file so a truncated stream (over the size limit) is
      // rejected before anything lands in storage.
      const buffer = await upload.toBuffer();
      if (upload.file.truncated) return reply.code(400).sendError('file_too_large');

      const objectKey = `${UPLOAD_PREFIX}/${randomUUID()}`;
      await app.minio.putObject(env.MINIO_BUCKET, objectKey, buffer, buffer.length, {
        'Content-Type': 'application/pdf',
      });

      return { objectKey, originalName: upload.filename ?? null };
    },
  );

  /* ── Create a new version (both PDFs already uploaded) ───────────────────── */

  fastify.post(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'Publish a new public-offer version',
        description:
          'Records the two uploaded PDFs and inserts a new version (MAX+1) that ' +
          'goes live immediately. Append-only — existing versions are never modified.',
        body: CreateBody,
        response: { 201: OfferVersion },
      },
    },
    async (request, reply) => {
      const adminId = Number((request.user as { sub: string }).sub);

      const row = await db.transaction(async (tx) => {
        const fileUz = await recordFile(tx, {
          objectKey: request.body.fileUz.objectKey,
          originalName: request.body.fileUz.originalName,
          mimeType: 'application/pdf',
          uploadedByType: 'admin',
          uploadedById: adminId,
        });
        const fileRu = await recordFile(tx, {
          objectKey: request.body.fileRu.objectKey,
          originalName: request.body.fileRu.originalName,
          mimeType: 'application/pdf',
          uploadedByType: 'admin',
          uploadedById: adminId,
        });

        // Next version = MAX(version)+1 (latest wins). Serialized by the unique
        // index on version — a concurrent double-publish fails and retries.
        const [{ next }] = await tx
          .select({ next: sql<number>`coalesce(max(${publicOffers.version}), 0) + 1` })
          .from(publicOffers);

        const [inserted] = await tx
          .insert(publicOffers)
          .values({
            version: next!,
            label: request.body.label?.trim() || null,
            fileUzId: fileUz.id,
            fileRuId: fileRu.id,
            createdBy: adminId,
          })
          .returning();
        return inserted!;
      });

      return reply.code(201).send(await serialize(row));
    },
  );

  /* ── Version history (newest first; top row is the current/active one) ───── */

  fastify.get(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'Public-offer version history',
        response: { 200: Type.Object({ versions: Type.Array(OfferVersion) }) },
      },
    },
    async () => {
      const rows = await db
        .select({
          id: publicOffers.id,
          version: publicOffers.version,
          label: publicOffers.label,
          createdAt: publicOffers.createdAt,
          fileUzId: publicOffers.fileUzId,
          fileRuId: publicOffers.fileRuId,
          createdByName: adminUsers.fullName,
        })
        .from(publicOffers)
        .leftJoin(adminUsers, eq(publicOffers.createdBy, adminUsers.id))
        .orderBy(desc(publicOffers.version));

      const versions = await Promise.all(rows.map((r) => serialize(r)));
      return { versions };
    },
  );

  // Attach fresh presigned download URLs for both PDFs to a version row.
  async function serialize(r: {
    id: number;
    version: number;
    label: string | null;
    createdAt: Date;
    fileUzId: number;
    fileRuId: number;
    createdByName?: string | null;
  }) {
    const [downloadUrlUz, downloadUrlRu] = await Promise.all([
      getDownloadUrl(db, r.fileUzId),
      getDownloadUrl(db, r.fileRuId),
    ]);
    return {
      id: r.id,
      version: r.version,
      label: r.label,
      createdAt: r.createdAt.toISOString(),
      createdByName: r.createdByName ?? null,
      downloadUrlUz,
      downloadUrlRu,
    };
  }
}
