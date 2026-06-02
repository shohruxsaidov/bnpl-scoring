import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { getCategory, updateCategory } from "./service"

function serializeCategory(c: NonNullable<Awaited<ReturnType<typeof getCategory>>>) {
  return { ...c, id: c.id.toString(), merchantId: c.merchantId.toString() }
}

export default async function adminCategoryRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  const IdParams = Type.Object({ id: Type.String() })

  const UpdateCategoryBody = Type.Partial(
    Type.Object({
      name: Type.String({ minLength: 1 }),
      active: Type.Boolean(),
    }),
  )

  const preHandler = app.verifyAdminJwt

  fastify.get(
    "/:id",
    { schema: { params: IdParams }, preHandler },
    async (request, reply) => {
      const category = await getCategory(db, BigInt(request.params.id))
      if (!category) return reply.code(404).sendError("not_found")
      return { category: serializeCategory(category) }
    },
  )

  fastify.patch(
    "/:id",
    { schema: { params: IdParams, body: UpdateCategoryBody }, preHandler },
    async (request, reply) => {
      const category = await updateCategory(db, BigInt(request.params.id), request.body)
      if (!category) return reply.code(404).sendError("not_found")
      return { category: serializeCategory(category) }
    },
  )
}
