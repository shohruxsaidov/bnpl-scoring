import { Type } from "@sinclair/typebox"
import fastifyMultipart from "@fastify/multipart"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { randomUUID } from "node:crypto"
import { db } from '@db'
import { env } from '@env'
import { deleteFile } from "../../../lib/file-storage"
import { sniffImageMime } from "../../../lib/image-type"
import { listMerchants } from "./queries/list-merchants/list-merchants.handler"
import { getScoringModel } from "../scoringModel/queries/get-scoring-model/get-scoring-model.handler"
import { getMerchant } from "./queries/get-merchant/get-merchant.handler"
import { listDocuments } from "./queries/list-documents/list-documents.handler"
import { getMerchantTariffs } from "./queries/get-merchant-tariffs/get-merchant-tariffs.handler"
import { createMerchant } from "./commands/create-merchant/create-merchant.handler"
import { updateMerchant } from "./commands/update-merchant/update-merchant.handler"
import { setMerchantLogo } from "./commands/set-merchant-logo/set-merchant-logo.handler"
import { clearMerchantLogo } from "./commands/clear-merchant-logo/clear-merchant-logo.handler"
import { recordDocument } from "./commands/record-document/record-document.handler"
import { assignTariff } from "./commands/assign-tariff/assign-tariff.handler"
import { removeTariff } from "./commands/remove-tariff/remove-tariff.handler"
import { listBranches } from "../branches/queries/list-branches/list-branches.handler"
import { createBranch } from "../branches/commands/create-branch/create-branch.handler"
import { Latitude, Longitude, hasLonelyCoordinate } from "../branches/coordinates"
import { listEnabledCategories } from "../categories/queries/list-enabled-categories/list-enabled-categories.handler"
import { getCategory } from "../categories/queries/get-category/get-category.handler"
import { enableMerchantCategory } from "../categories/commands/enable-merchant-category/enable-merchant-category.handler"
import { disableMerchantCategory } from "../categories/commands/disable-merchant-category/disable-merchant-category.handler"
import { isCategoryEnabledForMerchant } from "../categories/queries/is-category-enabled/is-category-enabled.handler"
import { listProducts } from "../products/queries/list-products/list-products.handler"
import { createProduct } from "../products/commands/create-product/create-product.handler"
import {
  serializeMerchant,
  serializeMerchants,
  serializeBranch,
  serializeCategory,
  serializeProduct,
  serializeDocument,
} from "./types"

const TAGS = ["Admin · Merchants"]

const LOGO_PREFIX = "merchant-logos"
const MAX_LOGO_BYTES = 2 * 1024 * 1024 // 2 MB — a logo needing more is a mistake

/**
 * Postgres unique-violation on merchants.inn — a merchant with that INN is
 * already registered.
 *
 * Two traps, both verified against the running DB: drizzle wraps every driver
 * error in a DrizzleQueryError that carries no `code`, so the PostgresError has
 * to be dug out of `cause`; and postgres.js spells the field `constraint_name`,
 * not `constraint`. Matching the constraint rather than a bare 23505 keeps a
 * future unique index on the table from being reported as a duplicate INN.
 */
function isInnConflict(err: unknown): boolean {
  type PgErrorLike = { code?: string; constraint_name?: string; cause?: unknown }
  let e = err as PgErrorLike | null | undefined
  for (let depth = 0; e && depth < 5; e = e.cause as PgErrorLike | null | undefined, depth++) {
    if (e.code === "23505" && e.constraint_name === "merchants_inn_unique") return true
  }
  return false
}

export default async function adminMerchantRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()

  // Scoped to this plugin: only the logo route consumes multipart, so the rest of
  // the admin API keeps its JSON-only body parsing.
  await app.register(fastifyMultipart, {
    limits: { fileSize: MAX_LOGO_BYTES, files: 1 },
    // Don't throw on oversize; flag `file.truncated` so we can reject with a
    // localized 400 (file_too_large) instead of an opaque 413.
    throwFileSizeLimit: false,
  })

  // logoUrl is absent from both write bodies on purpose. It is derived from
  // logoFileId on read, and the logo is settable only through the upload/delete
  // routes below — leaving it writable here would let an admin point a merchant's
  // logo at an arbitrary external URL.
  const CreateMerchantBody = Type.Object({
    name: Type.String({ minLength: 1 }),
    legalName: Type.String({ minLength: 1 }),
    inn: Type.String({ minLength: 1 }),
    phone: Type.String({ minLength: 1 }),
    address: Type.String({ minLength: 1 }),
    contractNumber: Type.Optional(Type.String()),
    scoringModelId: Type.Optional(Type.Integer()),
  })

  const UpdateMerchantBody = Type.Partial(
    Type.Object({
      name: Type.String({ minLength: 1 }),
      legalName: Type.String({ minLength: 1 }),
      inn: Type.String({ minLength: 1 }),
      phone: Type.String({ minLength: 1 }),
      address: Type.String({ minLength: 1 }),
      contractNumber: Type.String(),
      active: Type.Boolean(),
      // Hides the merchant from the client app's catalog without suspending them
      // operationally — see db/merchants.ts and modules/client/merchants.
      visibleInClientApp: Type.Boolean(),
      mfo: Type.String({ pattern: "^\\d{5}$" }),
      accountNumber: Type.String({ pattern: "^\\d{20}$" }),
      bankName: Type.String({ minLength: 1 }),
      // Holds either an oblast or a district id — the admin UI lets you stop at
      // either level. null clears it.
      regionId: Type.Union([Type.Integer(), Type.Null()]),
      // null clears the assignment → merchant falls back to the Global Model
      scoringModelId: Type.Union([Type.Integer(), Type.Null()]),
    }),
  )

  const IdParams = Type.Object({ id: Type.String() })

  const CreateBranchBody = Type.Object({
    name: Type.String({ minLength: 1 }),
    address: Type.String({ minLength: 1 }),
    phone: Type.String({ minLength: 1 }),
    regionId: Type.Optional(Type.Union([Type.Integer(), Type.Null()])),
    latitude: Type.Optional(Latitude),
    longitude: Type.Optional(Longitude),
  })

  const CreateProductBody = Type.Object({
    categoryId: Type.String(),
    name: Type.String({ minLength: 1 }),
    price: Type.String({ pattern: "^\\d+(\\.\\d{1,2})?$" }),
    mxikCode: Type.Optional(Type.String()),
    packageCode: Type.Optional(Type.Integer()),
    packageName: Type.Optional(Type.String()),
    isLabeled: Type.Optional(Type.Boolean()),
  })

  const RecordDocumentBody = Type.Object({
    fileUrl: Type.String({ minLength: 1 }),
    documentType: Type.String({ minLength: 1 }),
  })

  const preHandler = app.verifyAdminJwt

  /* ── Merchants ──────────────────────────────────────────────────────────── */

  fastify.get("/", { schema: { tags: TAGS }, preHandler }, async () => {
    const rows = await listMerchants()
    return { merchants: await serializeMerchants(rows) }
  })

  fastify.post(
    "/",
    { schema: { tags: TAGS, body: CreateMerchantBody }, preHandler },
    async (request, reply) => {
      if (request.body.scoringModelId !== undefined) {
        const model = await getScoringModel(request.body.scoringModelId)
        if (!model) return reply.code(404).sendError("scoring_model_not_found")
      }
      try {
        const merchant = await createMerchant(request.body)
        return reply.code(201).send({ merchant: await serializeMerchant(merchant) })
      } catch (err) {
        if (isInnConflict(err)) return reply.code(409).sendError("inn_taken")
        throw err
      }
    },
  )

  fastify.get(
    "/:id",
    { schema: { tags: TAGS, params: IdParams }, preHandler },
    async (request, reply) => {
      const merchant = await getMerchant(Number(request.params.id))
      if (!merchant) return reply.code(404).sendError("not_found")
      return { merchant: await serializeMerchant(merchant) }
    },
  )

  fastify.patch(
    "/:id",
    { schema: { tags: TAGS, params: IdParams, body: UpdateMerchantBody }, preHandler },
    async (request, reply) => {
      if (request.body.scoringModelId != null) {
        const model = await getScoringModel(request.body.scoringModelId)
        if (!model) return reply.code(404).sendError("scoring_model_not_found")
      }
      let merchant: Awaited<ReturnType<typeof updateMerchant>>
      try {
        merchant = await updateMerchant({ id: Number(request.params.id), patch: request.body })
      } catch (err) {
        // Same hole as on create: moving a merchant onto an INN somebody else
        // already holds must read as a duplicate, not an opaque 500.
        if (isInnConflict(err)) return reply.code(409).sendError("inn_taken")
        throw err
      }
      if (!merchant) return reply.code(404).sendError("not_found")
      return { merchant: await serializeMerchant(merchant) }
    },
  )

  /* ── Merchant logo ──────────────────────────────────────────────────────── */

  // Uploaded through the API rather than by presigned PUT (the pattern merchant
  // documents use) because these bytes are served publicly from our own origin:
  // the server has to be the one that decides the file really is an image.
  fastify.post(
    "/:id/logo",
    {
      schema: {
        tags: TAGS,
        summary: "Upload a merchant logo",
        params: IdParams,
        consumes: ["multipart/form-data"],
        response: { 400: { $ref: "ErrorResponse#" }, 404: { $ref: "ErrorResponse#" } },
      },
      preHandler,
    },
    async (request, reply) => {
      const merchantId = Number(request.params.id)
      const existing = await getMerchant(merchantId)
      if (!existing) return reply.code(404).sendError("not_found")

      const upload = await request.file()
      if (!upload) return reply.code(400).sendError("file_required")

      // Buffer first so a truncated stream (over the size limit) is rejected
      // before anything lands in storage.
      const buffer = await upload.toBuffer()
      if (upload.file.truncated) return reply.code(400).sendError("file_too_large")

      // The declared mimetype is caller-supplied and proves nothing; the bytes do.
      const mimeType = sniffImageMime(buffer)
      if (!mimeType) return reply.code(400).sendError("invalid_image_type")

      const objectKey = `${LOGO_PREFIX}/${merchantId}/${randomUUID()}`
      await app.minio.putObject(env.MINIO_BUCKET, objectKey, buffer, buffer.length, {
        "Content-Type": mimeType,
      })

      const adminId = Number((request.user as { sub: string }).sub)
      const { merchant, previousFileId } = await setMerchantLogo({
        merchantId,
        objectKey,
        mimeType,
        originalName: upload.filename ?? undefined,
        uploadedByAdminId: adminId,
      })

      // Only after the swap is committed — a rollback can't un-delete an object.
      if (previousFileId != null) await deleteFile(db, app.minio, previousFileId)

      return { merchant: await serializeMerchant(merchant) }
    },
  )

  fastify.delete(
    "/:id/logo",
    {
      schema: {
        tags: TAGS,
        summary: "Remove a merchant logo",
        params: IdParams,
        response: { 404: { $ref: "ErrorResponse#" } },
      },
      preHandler,
    },
    async (request, reply) => {
      const merchantId = Number(request.params.id)
      const existing = await getMerchant(merchantId)
      if (!existing) return reply.code(404).sendError("not_found")

      const { merchant, previousFileId } = await clearMerchantLogo(merchantId)
      if (previousFileId != null) await deleteFile(db, app.minio, previousFileId)

      return { merchant: await serializeMerchant(merchant) }
    },
  )

  /* ── Merchant branches ──────────────────────────────────────────────────── */

  fastify.get(
    "/:id/branches",
    { schema: { tags: TAGS, params: IdParams }, preHandler },
    async (request) => {
      const rows = await listBranches(Number(request.params.id))
      return { branches: rows.map(serializeBranch) }
    },
  )

  fastify.post(
    "/:id/branches",
    { schema: { tags: TAGS, params: IdParams, body: CreateBranchBody }, preHandler },
    async (request, reply) => {
      const merchant = await getMerchant(Number(request.params.id))
      if (!merchant) return reply.code(404).sendError("not_found")
      if (hasLonelyCoordinate(request.body)) return reply.code(400).sendError("invalid_coordinates")
      const branch = await createBranch({ merchantId: merchant.id, ...request.body })
      return reply.code(201).send({ branch: serializeBranch(branch) })
    },
  )

  /* ── Merchant categories ────────────────────────────────────────────────── */

  const CategoryIdParams = Type.Object({ id: Type.String(), categoryId: Type.String() })

  fastify.get(
    "/:id/categories",
    { schema: { tags: TAGS, params: IdParams }, preHandler },
    async (request) => {
      const rows = await listEnabledCategories(Number(request.params.id))
      return { categories: rows.map(serializeCategory) }
    },
  )

  fastify.post(
    "/:id/categories/:categoryId",
    { schema: { tags: TAGS, params: CategoryIdParams }, preHandler },
    async (request, reply) => {
      const category = await getCategory(Number(request.params.categoryId))
      if (!category) return reply.code(404).sendError("not_found")
      await enableMerchantCategory(category.id, Number(request.params.id))
      return reply.code(204).send()
    },
  )

  fastify.delete(
    "/:id/categories/:categoryId",
    { schema: { tags: TAGS, params: CategoryIdParams }, preHandler },
    async (request, reply) => {
      await disableMerchantCategory(Number(request.params.categoryId), Number(request.params.id))
      return reply.code(204).send()
    },
  )

  /* ── Merchant products ──────────────────────────────────────────────────── */

  fastify.get(
    "/:id/products",
    { schema: { tags: TAGS, params: IdParams }, preHandler },
    async (request) => {
      const rows = await listProducts(Number(request.params.id))
      return { products: rows.map(serializeProduct) }
    },
  )

  fastify.post(
    "/:id/products",
    { schema: { tags: TAGS, params: IdParams, body: CreateProductBody }, preHandler },
    async (request, reply) => {
      const merchant = await getMerchant(Number(request.params.id))
      if (!merchant) return reply.code(404).sendError("not_found")
      const categoryId = Number(request.body.categoryId)
      const enabled = await isCategoryEnabledForMerchant(categoryId, merchant.id)
      if (!enabled) return reply.code(400).sendError("category_not_enabled")
      const product = await createProduct({
        merchantId: merchant.id,
        categoryId,
        name: request.body.name,
        price: request.body.price,
        mxikCode: request.body.mxikCode,
        packageCode: request.body.packageCode,
        packageName: request.body.packageName,
        isLabeled: request.body.isLabeled,
      })
      return reply.code(201).send({ product: serializeProduct(product) })
    },
  )

  /* ── Merchant tariffs ──────────────────────────────────────────────────── */

  const TariffIdParams = Type.Object({ id: Type.String(), tariffId: Type.String() })

  fastify.get(
    "/:id/tariffs",
    { schema: { tags: TAGS, params: IdParams }, preHandler },
    async (request) => {
      const tariffList = await getMerchantTariffs(Number(request.params.id))
      return { tariffs: tariffList }
    },
  )

  fastify.post(
    "/:id/tariffs/:tariffId",
    { schema: { tags: TAGS, params: TariffIdParams }, preHandler },
    async (request, reply) => {
      await assignTariff(Number(request.params.id), Number(request.params.tariffId))
      return reply.code(204).send()
    },
  )

  fastify.delete(
    "/:id/tariffs/:tariffId",
    { schema: { tags: TAGS, params: TariffIdParams }, preHandler },
    async (request, reply) => {
      await removeTariff(Number(request.params.id), Number(request.params.tariffId))
      return reply.code(204).send()
    },
  )

  /* ── Merchant documents ─────────────────────────────────────────────────── */

  fastify.get(
    "/:id/documents",
    { schema: { tags: TAGS, params: IdParams }, preHandler },
    async (request) => {
      const rows = await listDocuments(Number(request.params.id))
      return { documents: rows.map(serializeDocument) }
    },
  )

  fastify.post(
    "/:id/documents/upload-url",
    { schema: { tags: TAGS, params: IdParams }, preHandler },
    async (request) => {
      const objectName = `merchants/${request.params.id}/${randomUUID()}`
      const uploadUrl = await app.minioPresignedPut(objectName)
      return { uploadUrl, objectName }
    },
  )

  fastify.post(
    "/:id/documents",
    { schema: { tags: TAGS, params: IdParams, body: RecordDocumentBody }, preHandler },
    async (request, reply) => {
      const adminId = Number((request.user as { sub: string }).sub)
      const doc = await recordDocument({
        merchantId: Number(request.params.id),
        fileUrl: request.body.fileUrl,
        documentType: request.body.documentType,
        uploadedByAdminId: adminId,
      })
      return reply.code(201).send({ document: serializeDocument(doc) })
    },
  )
}
