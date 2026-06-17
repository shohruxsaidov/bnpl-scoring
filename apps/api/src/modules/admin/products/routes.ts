import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { getProduct } from "./queries/get-product"
import { updateProduct } from "./commands/update-product"
import { isCategoryEnabledForMerchant } from "../categories/queries/is-category-enabled"

function serializeProduct(p: NonNullable<Awaited<ReturnType<typeof getProduct>>>) {
  return { ...p, id: p.id.toString(), merchantId: p.merchantId.toString(), categoryId: p.categoryId.toString() }
}

export default async function adminProductRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  const IdParams = Type.Object({ id: Type.String() })

  const UpdateProductBody = Type.Partial(
    Type.Object({
      categoryId: Type.String(),
      name: Type.String({ minLength: 1 }),
      price: Type.String({ pattern: "^\\d+(\\.\\d{1,2})?$" }),
      mxikCode: Type.String(),
      packageCode: Type.Integer(),
      packageName: Type.String(),
      active: Type.Boolean(),
    }),
  )

  const preHandler = app.verifyAdminJwt

  fastify.get(
    "/:id",
    { schema: { params: IdParams }, preHandler },
    async (request, reply) => {
      const product = await getProduct(db, Number(request.params.id))
      if (!product) return reply.code(404).sendError("not_found")
      return { product: serializeProduct(product) }
    },
  )

  fastify.patch(
    "/:id",
    { schema: { params: IdParams, body: UpdateProductBody }, preHandler },
    async (request, reply) => {
      const product = await getProduct(db, Number(request.params.id))
      if (!product) return reply.code(404).sendError("not_found")
      const categoryId = request.body.categoryId ? Number(request.body.categoryId) : undefined
      if (categoryId !== undefined) {
        const enabled = await isCategoryEnabledForMerchant(db, categoryId, product.merchantId)
        if (!enabled) return reply.code(400).sendError("category_not_enabled")
      }
      const updated = await updateProduct(db, product.id, { ...request.body, categoryId })
      if (!updated) return reply.code(404).sendError("not_found")
      return { product: serializeProduct(updated) }
    },
  )
}
