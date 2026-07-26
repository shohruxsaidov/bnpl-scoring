import { randomUUID } from 'node:crypto';
import { Type } from '@sinclair/typebox';
import fastifyMultipart from '@fastify/multipart';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import type { FastifyInstance } from 'fastify';
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '@db';
import { env } from '@env';
import {
  BANNER_ACTION_TYPES,
  BANNER_ASPECT_RATIO,
  BANNER_ASPECT_TOLERANCE,
  MIN_BANNER_IMAGE_WIDTH,
  banners,
  type BannerActionType,
} from '@db/banners';
import { adminUsers } from '@db/admin-users';
import { readImageSize, sniffImageMime } from '@lib/image-type';
import { getDownloadUrls, recordFile } from '../../../lib/file-storage';
import { filterVisibleMerchantIds } from '../../client/merchants/queries';

// ---------------------------------------------------------------------------
// Admin management of the client app's home-screen banners.
//
// Rows are mutable and there is no DELETE: removal is `isActive = false`. A
// deleted row would take its view count with it, orphan two objects in storage,
// and 404 the images of any app still holding a cached list — none of which is
// worth a tidier table (see db/banners.ts).
//
// Read responses attach PRESIGNED image URLs rather than the public ones the
// client app gets: the public route only serves banners that are currently
// live, and an admin has to be able to see the art for a campaign that starts
// next week, or one that finished last month.
// ---------------------------------------------------------------------------

const UPLOAD_PREFIX = 'banners';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export default async function adminBannerRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>();

  // Scoped to this plugin: only the image-upload route consumes multipart, so
  // the rest of the admin API keeps its JSON-only body parsing.
  await app.register(fastifyMultipart, {
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
    // Don't throw on oversize; flag `file.truncated` so we can reject with a
    // localized 400 (file_too_large) instead of an opaque 413.
    throwFileSizeLimit: false,
  });

  const TAGS = ['Admin · Banners'];
  const ERROR = { $ref: 'ErrorResponse#' };

  const IdParams = Type.Object({ id: Type.String({ pattern: '^\\d+$' }) });

  const UploadResponse = Type.Object(
    {
      objectKey: Type.String(),
      originalName: Type.Union([Type.String(), Type.Null()]),
      width: Type.Integer(),
      height: Type.Integer(),
    },
    {
      examples: [
        { objectKey: 'banners/uuid', originalName: 'summer-uz.png', width: 1440, height: 720 },
      ],
    },
  );

  const FileInput = Type.Object({
    objectKey: Type.String({ minLength: 1 }),
    originalName: Type.Optional(Type.String({ maxLength: 255 })),
    mimeType: Type.String({ minLength: 1 }),
  });

  // Spelled with an explicit type argument rather than left to inference: this
  // schema is reused across three bodies, and a widened `string` here would let a
  // bare cast decide what reaches the action_type column.
  const ActionType = Type.Unsafe<BannerActionType>({
    type: 'string',
    enum: [...BANNER_ACTION_TYPES],
    description:
      'What tapping the banner does. `actionValue` is the target: an https URL for ' +
      "'external_url', a merchant id for 'merchant', and must be omitted for 'none'.",
  });

  const CreateBody = Type.Object({
    title: Type.String({ minLength: 1, maxLength: 200 }),
    imageUz: FileInput,
    imageRu: FileInput,
    actionType: Type.Optional(ActionType),
    actionValue: Type.Optional(Type.Union([Type.String({ maxLength: 2000 }), Type.Null()])),
    isActive: Type.Optional(Type.Boolean()),
    startsAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
    endsAt: Type.Optional(Type.Union([Type.String({ format: 'date-time' }), Type.Null()])),
    sortOrder: Type.Optional(Type.Integer()),
  });

  // Every field is optional, including the images: replacing one locale's art is
  // a PATCH carrying a fresh objectKey, which mints a new file id and therefore a
  // new public URL — caches cannot serve the old picture.
  const UpdateBody = Type.Partial(CreateBody);

  const BannerView = Type.Object({
    id: Type.Integer(),
    title: Type.String(),
    imageUrlUz: Type.String(),
    imageUrlRu: Type.String(),
    actionType: ActionType,
    actionValue: Type.Union([Type.String(), Type.Null()]),
    isActive: Type.Boolean(),
    startsAt: Type.Union([Type.String(), Type.Null()]),
    endsAt: Type.Union([Type.String(), Type.Null()]),
    sortOrder: Type.Integer(),
    viewCount: Type.Integer(),
    // Whether a client would see this banner RIGHT NOW: isActive alone is not the
    // answer once a window is set, and re-deriving that rule in the UI is how the
    // two drift apart.
    isLive: Type.Boolean(),
    createdAt: Type.String(),
    updatedAt: Type.String(),
    createdByName: Type.Union([Type.String(), Type.Null()]),
  });

  /* ── Image upload (called once per locale; streams through the backend) ──── */

  fastify.post(
    '/upload',
    {
      schema: {
        tags: TAGS,
        summary: 'Upload a banner image to storage',
        consumes: ['multipart/form-data'],
        response: { 200: UploadResponse, 400: ERROR },
      },
    },
    async (request, reply) => {
      const upload = await request.file();
      if (!upload) return reply.code(400).sendError('file_required');

      // Buffer the whole file so a truncated stream (over the size limit) is
      // rejected before anything lands in storage.
      const buffer = await upload.toBuffer();
      if (upload.file.truncated) return reply.code(400).sendError('file_too_large');

      // The declared mimetype is caller-supplied and proves nothing; the bytes do.
      const mimeType = sniffImageMime(buffer);
      if (!mimeType) return reply.code(400).sendError('invalid_image_type');

      const size = readImageSize(buffer);
      // A file we cannot measure is rejected rather than waved through: the whole
      // point of the check is that the mistake surfaces here, in front of the
      // person who can fix it, instead of as cropped art on every phone.
      if (!size) return reply.code(400).sendError('invalid_image_type');
      if (size.width < MIN_BANNER_IMAGE_WIDTH) {
        return reply.code(400).sendError('image_too_small');
      }

      const objectKey = `${UPLOAD_PREFIX}/${randomUUID()}`;
      await app.minio.putObject(env.MINIO_BUCKET, objectKey, buffer, buffer.length, {
        'Content-Type': mimeType,
      });

      return {
        objectKey,
        originalName: upload.filename ?? null,
        width: size.width,
        height: size.height,
      };
    },
  );

  /* ── List ───────────────────────────────────────────────────────────────── */

  fastify.get(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'List banners',
        description:
          'In carousel order. `includeInactive` brings back deactivated and ' +
          'expired banners — the archive of what has run, which is the only ' +
          'record of it since banners are never deleted.',
        querystring: Type.Object({ includeInactive: Type.Optional(Type.Boolean()) }),
        response: { 200: Type.Object({ banners: Type.Array(BannerView) }) },
      },
    },
    async (request) => {
      const rows = await db
        .select({
          banner: banners,
          createdByName: adminUsers.fullName,
        })
        .from(banners)
        .leftJoin(adminUsers, eq(banners.createdBy, adminUsers.id))
        .where(request.query.includeInactive ? undefined : eq(banners.isActive, true))
        .orderBy(asc(banners.sortOrder), desc(banners.id));

      return { banners: await serializeMany(rows) };
    },
  );

  /* ── Detail ─────────────────────────────────────────────────────────────── */

  fastify.get(
    '/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Get a banner',
        params: IdParams,
        response: { 200: Type.Object({ banner: BannerView }), 404: ERROR },
      },
    },
    async (request, reply) => {
      const row = await findBanner(Number(request.params.id));
      if (!row) return reply.code(404).sendError('banner_not_found');
      const [banner] = await serializeMany([row]);
      return { banner: banner! };
    },
  );

  /* ── Create ─────────────────────────────────────────────────────────────── */

  fastify.post(
    '/',
    {
      schema: {
        tags: TAGS,
        summary: 'Create a banner',
        description:
          'Both images must already be uploaded. A banner is never half-built: ' +
          'the row and its two file records are written in one transaction.',
        body: CreateBody,
        response: { 201: Type.Object({ banner: BannerView }), 400: ERROR },
      },
    },
    async (request, reply) => {
      const body = request.body;
      const actionType = body.actionType ?? 'none';

      const actionError = await validateAction(actionType, body.actionValue ?? null);
      if (actionError) return reply.code(400).sendError(actionError);

      const windowError = validateWindow(
        body.startsAt ? new Date(body.startsAt) : null,
        body.endsAt ? new Date(body.endsAt) : null,
      );
      if (windowError) return reply.code(400).sendError(windowError);

      const adminId = Number((request.user as { sub: string }).sub);

      const inserted = await db.transaction(async (tx) => {
        const [fileUz, fileRu] = await Promise.all([
          recordFile(tx, {
            objectKey: body.imageUz.objectKey,
            originalName: body.imageUz.originalName,
            mimeType: body.imageUz.mimeType,
            uploadedByType: 'admin',
            uploadedById: adminId,
          }),
          recordFile(tx, {
            objectKey: body.imageRu.objectKey,
            originalName: body.imageRu.originalName,
            mimeType: body.imageRu.mimeType,
            uploadedByType: 'admin',
            uploadedById: adminId,
          }),
        ]);

        const [row] = await tx
          .insert(banners)
          .values({
            title: body.title.trim(),
            imageUzFileId: fileUz.id,
            imageRuFileId: fileRu.id,
            actionType,
            actionValue: normalizeActionValue(actionType, body.actionValue ?? null),
            isActive: body.isActive ?? true,
            startsAt: body.startsAt ? new Date(body.startsAt) : null,
            endsAt: body.endsAt ? new Date(body.endsAt) : null,
            sortOrder: body.sortOrder ?? 0,
            createdBy: adminId,
          })
          .returning();
        return row!;
      });

      const [banner] = await serializeMany([{ banner: inserted, createdByName: null }]);
      return reply.code(201).send({ banner: banner! });
    },
  );

  /* ── Update ─────────────────────────────────────────────────────────────── */

  fastify.patch(
    '/:id',
    {
      schema: {
        tags: TAGS,
        summary: 'Update a banner',
        description:
          'Any subset of fields. Deactivating (`isActive: false`) is how a banner ' +
          'is removed — there is no delete. Sending a new image objectKey replaces ' +
          "that locale's art and mints a new public URL.",
        params: IdParams,
        body: UpdateBody,
        response: { 200: Type.Object({ banner: BannerView }), 400: ERROR, 404: ERROR },
      },
    },
    async (request, reply) => {
      const id = Number(request.params.id);
      const existing = await findBanner(id);
      if (!existing) return reply.code(404).sendError('banner_not_found');

      const body = request.body;

      // The action is a pair, so it is validated as a pair against the state the
      // row will be in — patching only the type of an existing merchant banner
      // must not leave a URL sitting in action_value.
      const actionType = body.actionType ?? existing.banner.actionType;
      const actionValue =
        body.actionValue !== undefined ? body.actionValue : existing.banner.actionValue;
      const actionError = await validateAction(actionType, actionValue);
      if (actionError) return reply.code(400).sendError(actionError);

      const startsAt =
        body.startsAt !== undefined
          ? body.startsAt
            ? new Date(body.startsAt)
            : null
          : existing.banner.startsAt;
      const endsAt =
        body.endsAt !== undefined
          ? body.endsAt
            ? new Date(body.endsAt)
            : null
          : existing.banner.endsAt;
      const windowError = validateWindow(startsAt, endsAt);
      if (windowError) return reply.code(400).sendError(windowError);

      const adminId = Number((request.user as { sub: string }).sub);

      const updated = await db.transaction(async (tx) => {
        const imageUzFileId = body.imageUz
          ? (
              await recordFile(tx, {
                objectKey: body.imageUz.objectKey,
                originalName: body.imageUz.originalName,
                mimeType: body.imageUz.mimeType,
                uploadedByType: 'admin',
                uploadedById: adminId,
              })
            ).id
          : undefined;
        const imageRuFileId = body.imageRu
          ? (
              await recordFile(tx, {
                objectKey: body.imageRu.objectKey,
                originalName: body.imageRu.originalName,
                mimeType: body.imageRu.mimeType,
                uploadedByType: 'admin',
                uploadedById: adminId,
              })
            ).id
          : undefined;

        const [row] = await tx
          .update(banners)
          .set({
            ...(body.title !== undefined ? { title: body.title.trim() } : {}),
            ...(imageUzFileId !== undefined ? { imageUzFileId } : {}),
            ...(imageRuFileId !== undefined ? { imageRuFileId } : {}),
            actionType,
            actionValue: normalizeActionValue(actionType, actionValue),
            ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
            startsAt,
            endsAt,
            ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
            updatedAt: new Date(),
          })
          .where(eq(banners.id, id))
          .returning();
        return row!;
      });

      // The replaced file rows are deliberately left in place, unlike the merchant
      // logo swap which deletes the old object: an app that cached the old URL is
      // still fetching it, and a banner's previous art is part of the record of
      // what ran.
      const [banner] = await serializeMany([
        { banner: updated, createdByName: existing.createdByName },
      ]);
      return { banner: banner! };
    },
  );

  /* ── helpers ────────────────────────────────────────────────────────────── */

  async function findBanner(id: number) {
    const [row] = await db
      .select({ banner: banners, createdByName: adminUsers.fullName })
      .from(banners)
      .leftJoin(adminUsers, eq(banners.createdBy, adminUsers.id))
      .where(eq(banners.id, id))
      .limit(1);
    return row;
  }

  // 'none' carries no target; the other two require one. Enforced here rather
  // than as a CHECK because the merchant branch needs a catalog lookup — see
  // db/banners.ts.
  async function validateAction(
    actionType: BannerActionType,
    actionValue: string | null,
  ): Promise<string | null> {
    if (actionType === 'none') return null;

    const value = actionValue?.trim();
    if (!value) return 'action_value_required';

    if (actionType === 'external_url') {
      let url: URL;
      try {
        url = new URL(value);
      } catch {
        return 'invalid_action_url';
      }
      // https only: these open in the user's browser, and an http link on a
      // banner we published is a downgrade we would be handing out ourselves.
      if (url.protocol !== 'https:') return 'invalid_action_url';
      return null;
    }

    // actionType === 'merchant'
    if (!/^\d+$/.test(value)) return 'merchant_not_found';
    // The same predicate the client catalog uses, so a banner can never point at
    // a merchant the client app refuses to show. It can still go invisible later,
    // which the read path handles by dropping the banner.
    const visible = await filterVisibleMerchantIds([Number(value)]);
    return visible.has(Number(value)) ? null : 'merchant_not_found';
  }

  function normalizeActionValue(actionType: BannerActionType, actionValue: string | null) {
    if (actionType === 'none') return null;
    return actionValue?.trim() ?? null;
  }

  function validateWindow(startsAt: Date | null, endsAt: Date | null): string | null {
    if (startsAt && endsAt && endsAt <= startsAt) return 'invalid_banner_window';
    return null;
  }

  function isLive(row: typeof banners.$inferSelect, now: Date) {
    return (
      row.isActive &&
      (row.startsAt == null || row.startsAt <= now) &&
      (row.endsAt == null || row.endsAt > now)
    );
  }

  // One presign query for the whole page rather than two per row.
  async function serializeMany(
    rows: { banner: typeof banners.$inferSelect; createdByName: string | null }[],
  ) {
    const urls = await getDownloadUrls(
      db,
      rows.flatMap((r) => [r.banner.imageUzFileId, r.banner.imageRuFileId]),
    );
    const now = new Date();

    return rows.map(({ banner: b, createdByName }) => ({
      id: b.id,
      title: b.title,
      imageUrlUz: urls.get(b.imageUzFileId) ?? '',
      imageUrlRu: urls.get(b.imageRuFileId) ?? '',
      actionType: b.actionType,
      actionValue: b.actionValue,
      isActive: b.isActive,
      startsAt: b.startsAt?.toISOString() ?? null,
      endsAt: b.endsAt?.toISOString() ?? null,
      sortOrder: b.sortOrder,
      viewCount: b.viewCount,
      isLive: isLive(b, now),
      createdAt: b.createdAt.toISOString(),
      updatedAt: b.updatedAt.toISOString(),
      createdByName: createdByName ?? null,
    }));
  }
}
