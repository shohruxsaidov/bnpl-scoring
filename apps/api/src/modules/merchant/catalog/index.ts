import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listCategories } from "./queries/list-categories/list-categories.handler"
import { listProducts } from "./queries/list-products/list-products.handler"
import { createProduct } from "./commands/create-product/create-product.handler"
import { updateProduct } from "./commands/update-product/update-product.handler"
import { enableMerchantCategory } from "../../admin/categories/commands/enable-merchant-category/enable-merchant-category.handler"
import { disableMerchantCategory } from "../../admin/categories/commands/disable-merchant-category/disable-merchant-category.handler"
import { isCategoryEnabledForMerchant } from "../../admin/categories/queries/is-category-enabled/is-category-enabled.handler"
import { getCategory } from "../../admin/categories/queries/get-category/get-category.handler"

type MerchantPayload = { sub: string; merchantId: string; role: string }

function merchantId(request: { user: unknown }) {
  return Number((request.user as MerchantPayload).merchantId)
}

function serializeCategory(c: NonNullable<Awaited<ReturnType<typeof listCategories>>>[number]) {
  return { ...c, id: c.id.toString() }
}

function serializeProduct(p: NonNullable<Awaited<ReturnType<typeof createProduct>>>) {
  return { ...p, id: p.id.toString(), merchantId: p.merchantId.toString(), categoryId: p.categoryId.toString() }
}

const TAGS = ["Merchant · Catalog"]

export default async function merchantCatalogRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const preHandler = app.verifyMerchantJwt
  const manageCategories = [app.verifyMerchantJwt, app.requirePermission("manage_categories")]
  const manageProducts = [app.verifyMerchantJwt, app.requirePermission("manage_products")]

  const IdParams = Type.Object({ id: Type.String() })

  const CreateProductBody = Type.Object({
    categoryId: Type.String(),
    name: Type.String({ minLength: 1 }),
    price: Type.String({ pattern: "^\\d+(\\.\\d{1,2})?$" }),
    mxikCode: Type.Optional(Type.String()),
    packageCode: Type.Optional(Type.Integer()),
    packageName: Type.Optional(Type.String()),
  })
  const UpdateProductBody = Type.Partial(Type.Object({
    categoryId: Type.String(),
    name: Type.String({ minLength: 1 }),
    price: Type.String({ pattern: "^\\d+(\\.\\d{1,2})?$" }),
    mxikCode: Type.String(),
    packageCode: Type.Integer(),
    packageName: Type.String(),
    active: Type.Boolean(),
  }))

  /* ── Categories ─────────────────────────────────────────────────────────── */

  fastify.get("/categories", { schema: { tags: TAGS }, preHandler }, async (request) => {
    const rows = await listCategories(merchantId(request))
    return { categories: rows.map(serializeCategory) }
  })

  fastify.post("/categories/:id", { schema: { tags: TAGS, params: IdParams }, preHandler: manageCategories }, async (request, reply) => {
    const category = await getCategory(Number(request.params.id))
    if (!category) return reply.code(404).sendError("not_found")
    await enableMerchantCategory(category.id, merchantId(request))
    return reply.code(204).send()
  })

  fastify.delete("/categories/:id", { schema: { tags: TAGS, params: IdParams }, preHandler: manageCategories }, async (request, reply) => {
    await disableMerchantCategory(Number(request.params.id), merchantId(request))
    return reply.code(204).send()
  })

  /* ── Products ───────────────────────────────────────────────────────────── */

  fastify.get("/products", { schema: { tags: TAGS }, preHandler }, async (request) => {
    const rows = await listProducts(merchantId(request))
    return { products: rows.map(serializeProduct) }
  })

  fastify.post("/products", { schema: { tags: TAGS, body: CreateProductBody }, preHandler: manageProducts }, async (request, reply) => {
    const mId = merchantId(request)
    const categoryId = Number(request.body.categoryId)
    const enabled = await isCategoryEnabledForMerchant(categoryId, mId)
    if (!enabled) return reply.code(400).sendError("category_not_enabled")
    const product = await createProduct({
      merchantId: mId,
      categoryId,
      name: request.body.name,
      price: request.body.price,
      mxikCode: request.body.mxikCode,
      packageCode: request.body.packageCode,
      packageName: request.body.packageName,
    })
    return reply.code(201).send({ product: serializeProduct(product) })
  })

  fastify.patch("/products/:id", { schema: { tags: TAGS, params: IdParams, body: UpdateProductBody }, preHandler: manageProducts }, async (request, reply) => {
    const mId = merchantId(request)
    const categoryId = request.body.categoryId ? Number(request.body.categoryId) : undefined
    if (categoryId !== undefined) {
      const enabled = await isCategoryEnabledForMerchant(categoryId, mId)
      if (!enabled) return reply.code(400).sendError("category_not_enabled")
    }
    const input = { ...request.body, categoryId }
    const product = await updateProduct(Number(request.params.id), mId, input)
    if (!product) return reply.code(404).sendError("not_found")
    return { product: serializeProduct(product) }
  })
}
