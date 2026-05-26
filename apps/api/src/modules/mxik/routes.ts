import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { lookupMxik, searchMxik } from "./service"

export default async function mxikRoutes(app: FastifyInstance, opts: { preHandler: unknown }) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db
  const preHandler = opts.preHandler as FastifyInstance["verifyMerchantJwt"]

  const LookupQuery = Type.Object({ code: Type.String({ minLength: 17, maxLength: 17 }) })
  const SearchQuery = Type.Object({ q: Type.String({ minLength: 2 }) })

  fastify.get("/lookup", { schema: { querystring: LookupQuery }, preHandler }, async (request, reply) => {
    try {
      const entry = await lookupMxik(db, request.query.code)
      return { mxik: entry }
    } catch {
      return reply.code(404).send({ code: "mxik_not_found" })
    }
  })

  fastify.get("/search", { schema: { querystring: SearchQuery }, preHandler }, async (request) => {
    const results = await searchMxik(db, request.query.q)
    return { results }
  })
}
