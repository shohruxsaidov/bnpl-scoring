import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { getCollectionBoard } from "./queries/get-collection-board"

export default async function adminCollectionBoardRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db
  const preHandler = app.verifyAdminJwt

  const ListQuery = Type.Object({
    merchantId: Type.Optional(Type.String()),
  })

  fastify.get("/", { schema: { querystring: ListQuery }, preHandler }, async (request) => {
    const { merchantId } = request.query
    const buckets = await getCollectionBoard(db, {
      merchantId: merchantId ? BigInt(merchantId) : undefined,
    })
    return { buckets }
  })
}
