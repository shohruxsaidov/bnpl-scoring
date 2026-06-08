import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listAdminDeals } from "./queries/list-deals"
import { getAdminDeal } from "./queries/get-deal"
import { listDealComments } from "./queries/list-deal-comments"
import { createDealComment } from "./commands/create-deal-comment"

export default async function adminDealRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db
  const preHandler = app.verifyAdminJwt

  const ListQuery = Type.Object({
    status: Type.Optional(Type.String()),
    merchantId: Type.Optional(Type.String()),
  })

  const IdParams = Type.Object({ id: Type.String() })

  const CreateCommentBody = Type.Object({
    text: Type.String({ minLength: 1, maxLength: 2000 }),
  })

  fastify.get("/", { schema: { querystring: ListQuery }, preHandler }, async (request) => {
    const { status, merchantId } = request.query
    const deals = await listAdminDeals(db, {
      status: status || undefined,
      merchantId: merchantId ? BigInt(merchantId) : undefined,
    })
    return { deals }
  })

  fastify.get("/:id", { schema: { params: IdParams }, preHandler }, async (request, reply) => {
    const deal = await getAdminDeal(db, request.params.id)
    if (!deal) return reply.code(404).sendError("not_found")
    return { deal }
  })

  fastify.get("/:id/comments", { schema: { params: IdParams }, preHandler }, async (request) => {
    const comments = await listDealComments(db, request.params.id)
    return { comments }
  })

  fastify.post(
    "/:id/comments",
    { schema: { params: IdParams, body: CreateCommentBody }, preHandler },
    async (request, reply) => {
      const adminUserId = BigInt((request.user as { sub: string }).sub)
      const comment = await createDealComment(db, request.params.id, adminUserId, request.body.text)
      return reply.code(201).send({ comment })
    },
  )
}
