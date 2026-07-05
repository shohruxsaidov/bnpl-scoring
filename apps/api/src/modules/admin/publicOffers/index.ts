import { Type } from '@sinclair/typebox';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@db';
import { publicOffers } from '@db/public-offers';
import { adminUsers } from '@db/admin-users';
import { createUploadUrl, recordFile, getDownloadUrl } from '../../../lib/file-storage';

// ---------------------------------------------------------------------------
// Admin management of the versioned, PDF-based public offer. Read + create
// only: versions are append-only and immutable (a version a client accepted
// must never change), so there is no update or delete. A new version goes live
// on insert and is only created once both PDFs (uz + ru) have been uploaded.
// ---------------------------------------------------------------------------

const UPLOAD_PREFIX = 'public-offers';

export default async function adminPublicOfferRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();

  const TAGS = ['Admin · Public Offer'];

  const UploadUrlResponse = Type.Object(
    { uploadUrl: Type.String(), objectKey: Type.String() },
    { examples: [{ uploadUrl: 'https://minio.../public-offers/uuid?X-Amz-...', objectKey: 'public-offers/uuid' }] },
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

  /* ── Presigned upload URL (called once per PDF) ──────────────────────────── */

  fastify.post(
    '/upload-url',
    {
      schema: {
        tags: TAGS,
        summary: 'Presigned upload URL for a public-offer PDF',
        response: { 200: UploadUrlResponse },
      },
    },
    async () => {
      const { uploadUrl, objectKey } = await createUploadUrl({ prefix: UPLOAD_PREFIX });
      return { uploadUrl, objectKey };
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
