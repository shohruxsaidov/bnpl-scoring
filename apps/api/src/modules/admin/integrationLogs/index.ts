import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import {
  listIntegrationLogs,
  listIntegrationNames,
} from "./queries/list-integration-logs/list-integration-logs.handler"
import { getIntegrationLog } from "./queries/get-integration-log/get-integration-log.handler"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default async function adminIntegrationLogRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const preHandler = app.verifyAdminJwt

  const ListQuery = Type.Object({
    from: Type.Optional(Type.String({ format: "date-time" })),
    to: Type.Optional(Type.String({ format: "date-time" })),
    integration: Type.Optional(Type.String()),
    result: Type.Optional(
      Type.Union([Type.Literal("success"), Type.Literal("error")]),
    ),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
    offset: Type.Optional(Type.Integer({ minimum: 0 })),
  })

  const IdParams = Type.Object({ id: Type.String() })

  fastify.get("/", { schema: { querystring: ListQuery }, preHandler }, async (request) => {
    const { from, to, integration, result, limit, offset } = request.query
    const { logs, total } = await listIntegrationLogs({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      integration: integration || undefined,
      result,
      limit: limit ?? 50,
      offset: offset ?? 0,
    })
    return { logs, total }
  })

  fastify.get("/integrations", { preHandler }, async () => {
    const integrations = await listIntegrationNames()
    return { integrations }
  })

  fastify.get("/:id", { schema: { params: IdParams }, preHandler }, async (request, reply) => {
    if (!UUID_RE.test(request.params.id)) return reply.code(400).sendError("invalid_id")

    const log = await getIntegrationLog(request.params.id)
    if (!log) return reply.code(404).sendError("not_found")
    return { log }
  })
}
