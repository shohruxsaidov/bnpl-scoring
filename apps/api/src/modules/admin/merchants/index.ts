import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { randomUUID } from "node:crypto"
import { listMerchants } from "./queries/list-merchants/list-merchants.handler"
import { getScoringModel } from "../scoringModel/queries/get-scoring-model"
import { getMerchant } from "./queries/get-merchant/get-merchant.handler"
import { listDocuments } from "./queries/list-documents/list-documents.handler"
import { getMerchantTariffs } from "./queries/get-merchant-tariffs/get-merchant-tariffs.handler"
import { createMerchant } from "./commands/create-merchant/create-merchant.handler"
import { updateMerchant } from "./commands/update-merchant/update-merchant.handler"
import { recordDocument } from "./commands/record-document/record-document.handler"
import { assignTariff } from "./commands/assign-tariff/assign-tariff.handler"
import { removeTariff } from "./commands/remove-tariff/remove-tariff.handler"
import { listBranches } from "../branches/queries/list-branches/list-branches.handler"
import { createBranch } from "../branches/commands/create-branch/create-branch.handler"
import { listEnabledCategories } from "../categories/queries/list-enabled-categories"
import { getCategory } from "../categories/queries/get-category"
import { enableMerchantCategory } from "../categories/commands/enable-merchant-category"
import { disableMerchantCategory } from "../categories/commands/disable-merchant-category"
import { isCategoryEnabledForMerchant } from "../categories/queries/is-category-enabled"
import { listProducts } from "../products/queries/list-products"
import { createProduct } from "../products/commands/create-product"
import {
  serializeMerchant,
  serializeBranch,
  serializeCategory,
  serializeProduct,
  serializeDocument,
} from "./types"

export default async function adminMerchantRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  const CreateMerchantBody = Type.Object({
    name: Type.String({ minLength: 1 }),
    legalName: Type.String({ minLength: 1 }),
    inn: Type.String({ minLength: 1 }),
    phone: Type.String({ minLength: 1 }),
    address: Type.String({ minLength: 1 }),
    logoUrl: Type.Optional(Type.String()),
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
      logoUrl: Type.String(),
      contractNumber: Type.String(),
      active: Type.Boolean(),
      mfo: Type.String({ pattern: "^\\d{5}$" }),
      accountNumber: Type.String({ pattern: "^\\d{20}$" }),
      bankName: Type.String({ minLength: 1 }),
      // null clears the assignment → merchant falls back to the Global Model
      scoringModelId: Type.Union([Type.Integer(), Type.Null()]),
    }),
  )

  const IdParams = Type.Object({ id: Type.String() })

  const CreateBranchBody = Type.Object({
    name: Type.String({ minLength: 1 }),
    address: Type.String({ minLength: 1 }),
    phone: Type.String({ minLength: 1 }),
  })

  const CreateProductBody = Type.Object({
    categoryId: Type.String(),
    name: Type.String({ minLength: 1 }),
    price: Type.String({ pattern: "^\\d+(\\.\\d{1,2})?$" }),
    mxikCode: Type.Optional(Type.String()),
    packageCode: Type.Optional(Type.Integer()),
    packageName: Type.Optional(Type.String()),
  })

  const RecordDocumentBody = Type.Object({
    fileUrl: Type.String({ minLength: 1 }),
    documentType: Type.String({ minLength: 1 }),
  })

  const preHandler = app.verifyAdminJwt

  /* ── Merchants ──────────────────────────────────────────────────────────── */

  fastify.get("/", { preHandler }, async () => {
    const rows = await listMerchants()
    return { merchants: rows.map(serializeMerchant) }
  })

  fastify.post(
    "/",
    { schema: { body: CreateMerchantBody }, preHandler },
    async (request, reply) => {
      if (request.body.scoringModelId !== undefined) {
        const model = await getScoringModel(db, request.body.scoringModelId)
        if (!model) return reply.code(404).sendError("scoring_model_not_found")
      }
      const merchant = await createMerchant(request.body)
      return reply.code(201).send({ merchant: serializeMerchant(merchant) })
    },
  )

  fastify.get(
    "/:id",
    { schema: { params: IdParams }, preHandler },
    async (request, reply) => {
      const merchant = await getMerchant(Number(request.params.id))
      if (!merchant) return reply.code(404).sendError("not_found")
      return { merchant: serializeMerchant(merchant) }
    },
  )

  fastify.patch(
    "/:id",
    { schema: { params: IdParams, body: UpdateMerchantBody }, preHandler },
    async (request, reply) => {
      if (request.body.scoringModelId != null) {
        const model = await getScoringModel(db, request.body.scoringModelId)
        if (!model) return reply.code(404).sendError("scoring_model_not_found")
      }
      const merchant = await updateMerchant({ id: Number(request.params.id), patch: request.body })
      if (!merchant) return reply.code(404).sendError("not_found")
      return { merchant: serializeMerchant(merchant) }
    },
  )

  /* ── Merchant branches ──────────────────────────────────────────────────── */

  fastify.get(
    "/:id/branches",
    { schema: { params: IdParams }, preHandler },
    async (request) => {
      const rows = await listBranches(Number(request.params.id))
      return { branches: rows.map(serializeBranch) }
    },
  )

  fastify.post(
    "/:id/branches",
    { schema: { params: IdParams, body: CreateBranchBody }, preHandler },
    async (request, reply) => {
      const merchant = await getMerchant(Number(request.params.id))
      if (!merchant) return reply.code(404).sendError("not_found")
      const branch = await createBranch({ merchantId: merchant.id, ...request.body })
      return reply.code(201).send({ branch: serializeBranch(branch) })
    },
  )

  /* ── Merchant categories ────────────────────────────────────────────────── */

  const CategoryIdParams = Type.Object({ id: Type.String(), categoryId: Type.String() })

  fastify.get(
    "/:id/categories",
    { schema: { params: IdParams }, preHandler },
    async (request) => {
      const rows = await listEnabledCategories(db, Number(request.params.id))
      return { categories: rows.map(serializeCategory) }
    },
  )

  fastify.post(
    "/:id/categories/:categoryId",
    { schema: { params: CategoryIdParams }, preHandler },
    async (request, reply) => {
      const category = await getCategory(db, Number(request.params.categoryId))
      if (!category) return reply.code(404).sendError("not_found")
      await enableMerchantCategory(db, category.id, Number(request.params.id))
      return reply.code(204).send()
    },
  )

  fastify.delete(
    "/:id/categories/:categoryId",
    { schema: { params: CategoryIdParams }, preHandler },
    async (request, reply) => {
      await disableMerchantCategory(db, Number(request.params.categoryId), Number(request.params.id))
      return reply.code(204).send()
    },
  )

  /* ── Merchant products ──────────────────────────────────────────────────── */

  fastify.get(
    "/:id/products",
    { schema: { params: IdParams }, preHandler },
    async (request) => {
      const rows = await listProducts(db, Number(request.params.id))
      return { products: rows.map(serializeProduct) }
    },
  )

  fastify.post(
    "/:id/products",
    { schema: { params: IdParams, body: CreateProductBody }, preHandler },
    async (request, reply) => {
      const merchant = await getMerchant(Number(request.params.id))
      if (!merchant) return reply.code(404).sendError("not_found")
      const categoryId = Number(request.body.categoryId)
      const enabled = await isCategoryEnabledForMerchant(db, categoryId, merchant.id)
      if (!enabled) return reply.code(400).sendError("category_not_enabled")
      const product = await createProduct(db, {
        merchantId: merchant.id,
        categoryId,
        name: request.body.name,
        price: request.body.price,
        mxikCode: request.body.mxikCode,
        packageCode: request.body.packageCode,
        packageName: request.body.packageName,
      })
      return reply.code(201).send({ product: serializeProduct(product) })
    },
  )

  /* ── Merchant tariffs ──────────────────────────────────────────────────── */

  const TariffIdParams = Type.Object({ id: Type.String(), tariffId: Type.String() })

  fastify.get(
    "/:id/tariffs",
    { schema: { params: IdParams }, preHandler },
    async (request) => {
      const tariffList = await getMerchantTariffs(Number(request.params.id))
      return { tariffs: tariffList }
    },
  )

  fastify.post(
    "/:id/tariffs/:tariffId",
    { schema: { params: TariffIdParams }, preHandler },
    async (request, reply) => {
      await assignTariff(Number(request.params.id), Number(request.params.tariffId))
      return reply.code(204).send()
    },
  )

  fastify.delete(
    "/:id/tariffs/:tariffId",
    { schema: { params: TariffIdParams }, preHandler },
    async (request, reply) => {
      await removeTariff(Number(request.params.id), Number(request.params.tariffId))
      return reply.code(204).send()
    },
  )

  /* ── Merchant documents ─────────────────────────────────────────────────── */

  fastify.get(
    "/:id/documents",
    { schema: { params: IdParams }, preHandler },
    async (request) => {
      const rows = await listDocuments(Number(request.params.id))
      return { documents: rows.map(serializeDocument) }
    },
  )

  fastify.post(
    "/:id/documents/upload-url",
    { schema: { params: IdParams }, preHandler },
    async (request) => {
      const objectName = `merchants/${request.params.id}/${randomUUID()}`
      const uploadUrl = await app.minioPresignedPut(objectName)
      return { uploadUrl, objectName }
    },
  )

  fastify.post(
    "/:id/documents",
    { schema: { params: IdParams, body: RecordDocumentBody }, preHandler },
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
