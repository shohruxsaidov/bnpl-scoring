import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listBuyouts } from "./queries/list-buyouts"
import { markBuyoutPaid } from "./commands/mark-buyout-paid"

export default async function adminBuyoutRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  const ListQuery = Type.Object({
    merchantId: Type.Optional(Type.String()),
    status: Type.Optional(Type.String()),
  })

  const IdParams = Type.Object({ id: Type.String() })

  fastify.get("/", { schema: { querystring: ListQuery } }, async (request) => {
    const { merchantId, status } = request.query
    const buyouts = await listBuyouts(db, {
      merchantId: merchantId ? BigInt(merchantId) : undefined,
      status: status || undefined,
    })
    return { buyouts }
  })

  fastify.patch("/:id/pay", { schema: { params: IdParams } }, async (request, reply) => {
    const buyout = await markBuyoutPaid(db, BigInt(request.params.id))
    if (!buyout) return reply.code(404).sendError("not_found")
    return { buyout }
  })
}
