import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listAllScorings, listUniqueClients } from "./queries/list-scorings"
import { getScoring } from "./queries/get-scoring"

export default async function adminScoringHistoryRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db
  const preHandler = app.verifyAdminJwt

  const IdParams = Type.Object({ id: Type.String() })

  fastify.get("/", { preHandler }, async () => {
    const clients = await listUniqueClients(db)
    return { clients }
  })

  fastify.get("/all", { preHandler }, async () => {
    const records = await listAllScorings(db)
    return { records }
  })

  fastify.get("/:id", { schema: { params: IdParams }, preHandler }, async (request, reply) => {
    let scoringId: bigint
    try {
      scoringId = BigInt(request.params.id)
    } catch {
      return reply.code(400).sendError("invalid_id")
    }

    const scoring = await getScoring(db, scoringId)
    if (!scoring) return reply.code(404).sendError("scoring_not_found")
    return { scoring }
  })
}
