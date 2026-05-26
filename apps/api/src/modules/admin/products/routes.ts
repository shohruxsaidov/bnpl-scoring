import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { getProduct, updateProduct } from "./service"

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
      tanNarxi: Type.String({ pattern: "^\\d+(\\.\\d{1,2})?$" }),
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
      const product = await getProduct(db, BigInt(request.params.id))
      if (!product) return reply.code(404).send({ code: "not_found" })
      return { product: serializeProduct(product) }
    },
  )

  fastify.patch(
    "/:id",
    { schema: { params: IdParams, body: UpdateProductBody }, preHandler },
    async (request, reply) => {
      const input = {
        ...request.body,
        categoryId: request.body.categoryId ? BigInt(request.body.categoryId) : undefined,
      }
      const product = await updateProduct(db, BigInt(request.params.id), input)
      if (!product) return reply.code(404).send({ code: "not_found" })
      return { product: serializeProduct(product) }
    },
  )
}
