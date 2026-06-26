import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listScorings } from "./queries/list-scorings/list-scorings.handler"
import { getScoring } from "./queries/get-scoring/get-scoring.handler"

export default async function adminScoringRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()

  const ListQuery = Type.Object({
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
    offset: Type.Optional(Type.Integer({ minimum: 0 })),
  })

  const IdParams = Type.Object({ id: Type.Integer({ minimum: 1 }) })

  fastify.get("/", { schema: { querystring: ListQuery } }, async (request) => {
    const { limit, offset } = request.query
    const { scorings, total } = await listScorings({
      limit: limit ?? 25,
      offset: offset ?? 0,
    })
    return { scorings, total }
  })

  fastify.get("/:id", { schema: { params: IdParams } }, async (request, reply) => {
    const scoring = await getScoring(request.params.id)
    if (!scoring) return reply.code(404).sendError("not_found")
    return { scoring }
  })
}
