import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listAllScorings, listUniqueClients } from "./queries/list-scorings/list-scorings.handler"
import { getScoring } from "./queries/get-scoring/get-scoring.handler"

export default async function adminScoringHistoryRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const preHandler = app.verifyAdminJwt

  const IdParams = Type.Object({ id: Type.String() })

  fastify.get("/", { preHandler }, async () => {
    const clients = await listUniqueClients()
    return { clients }
  })

  fastify.get("/all", { preHandler }, async () => {
    const records = await listAllScorings()
    return { records }
  })

  fastify.get("/:id", { schema: { params: IdParams }, preHandler }, async (request, reply) => {
    let scoringId: number
    try {
      scoringId = Number(request.params.id)
    } catch {
      return reply.code(400).sendError("invalid_id")
    }

    const scoring = await getScoring(scoringId)
    if (!scoring) return reply.code(404).sendError("scoring_not_found")
    return { scoring }
  })
}
