import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import {
  listCategories, createCategory, updateCategory,
  listProducts, createProduct, updateProduct,
} from "./service"

type MerchantPayload = { sub: string; merchantId: string; role: string }

function merchantId(request: { user: unknown }) {
  return BigInt((request.user as MerchantPayload).merchantId)
}

function serializeCategory(c: NonNullable<Awaited<ReturnType<typeof createCategory>>>) {
  return { ...c, id: c.id.toString(), merchantId: c.merchantId.toString() }
}

function serializeProduct(p: NonNullable<Awaited<ReturnType<typeof createProduct>>>) {
  return { ...p, id: p.id.toString(), merchantId: p.merchantId.toString(), categoryId: p.categoryId.toString() }
}

export default async function merchantCatalogRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db
  const preHandler = app.verifyMerchantJwt
  const manageCategories = [app.verifyMerchantJwt, app.requirePermission("manage_categories")]
  const manageProducts = [app.verifyMerchantJwt, app.requirePermission("manage_products")]

  const IdParams = Type.Object({ id: Type.String() })

  const CreateCategoryBody = Type.Object({ name: Type.String({ minLength: 1 }) })
  const UpdateCategoryBody = Type.Partial(Type.Object({ name: Type.String({ minLength: 1 }), active: Type.Boolean() }))

  const CreateProductBody = Type.Object({
    categoryId: Type.String(),
    name: Type.String({ minLength: 1 }),
    tanNarxi: Type.String({ pattern: "^\\d+(\\.\\d{1,2})?$" }),
    mxikCode: Type.Optional(Type.String()),
    packageCode: Type.Optional(Type.Integer()),
    packageName: Type.Optional(Type.String()),
  })
  const UpdateProductBody = Type.Partial(Type.Object({
    categoryId: Type.String(),
    name: Type.String({ minLength: 1 }),
    tanNarxi: Type.String({ pattern: "^\\d+(\\.\\d{1,2})?$" }),
    mxikCode: Type.String(),
    packageCode: Type.Integer(),
    packageName: Type.String(),
    active: Type.Boolean(),
  }))

  /* ── Categories ─────────────────────────────────────────────────────────── */

  fastify.get("/categories", { preHandler }, async (request) => {
    const rows = await listCategories(db, merchantId(request))
    return { categories: rows.map(serializeCategory) }
  })

  fastify.post("/categories", { schema: { body: CreateCategoryBody }, preHandler: manageCategories }, async (request, reply) => {
    const category = await createCategory(db, { merchantId: merchantId(request), name: request.body.name })
    return reply.code(201).send({ category: serializeCategory(category) })
  })

  fastify.patch("/categories/:id", { schema: { params: IdParams, body: UpdateCategoryBody }, preHandler: manageCategories }, async (request, reply) => {
    const category = await updateCategory(db, BigInt(request.params.id), merchantId(request), request.body)
    if (!category) return reply.code(404).sendError("not_found")
    return { category: serializeCategory(category) }
  })

  /* ── Products ───────────────────────────────────────────────────────────── */

  fastify.get("/products", { preHandler }, async (request) => {
    const rows = await listProducts(db, merchantId(request))
    return { products: rows.map(serializeProduct) }
  })

  fastify.post("/products", { schema: { body: CreateProductBody }, preHandler: manageProducts }, async (request, reply) => {
    const product = await createProduct(db, {
      merchantId: merchantId(request),
      categoryId: BigInt(request.body.categoryId),
      name: request.body.name,
      tanNarxi: request.body.tanNarxi,
      mxikCode: request.body.mxikCode,
      packageCode: request.body.packageCode,
      packageName: request.body.packageName,
    })
    return reply.code(201).send({ product: serializeProduct(product) })
  })

  fastify.patch("/products/:id", { schema: { params: IdParams, body: UpdateProductBody }, preHandler: manageProducts }, async (request, reply) => {
    const input = {
      ...request.body,
      categoryId: request.body.categoryId ? BigInt(request.body.categoryId) : undefined,
    }
    const product = await updateProduct(db, BigInt(request.params.id), merchantId(request), input)
    if (!product) return reply.code(404).sendError("not_found")
    return { product: serializeProduct(product) }
  })
}
