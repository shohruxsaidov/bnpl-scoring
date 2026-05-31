import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { listAdminDeals, getAdminDeal, listDealComments, createDealComment } from './service'

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

  /* GET /admin/deals */
  fastify.get('/', { schema: { querystring: ListQuery }, preHandler }, async (request) => {
    const { status, merchantId } = request.query
    const deals = await listAdminDeals(db, {
      status: status || undefined,
      merchantId: merchantId ? BigInt(merchantId) : undefined,
    })
    return { deals }
  })

  /* GET /admin/deals/:id */
  fastify.get('/:id', { schema: { params: IdParams }, preHandler }, async (request, reply) => {
    const deal = await getAdminDeal(db, request.params.id)
    if (!deal) return reply.code(404).send({ code: 'not_found' })
    return { deal }
  })

  /* GET /admin/deals/:id/comments */
  fastify.get('/:id/comments', { schema: { params: IdParams }, preHandler }, async (request) => {
    const comments = await listDealComments(db, request.params.id)
    return { comments }
  })

  /* POST /admin/deals/:id/comments */
  fastify.post(
    '/:id/comments',
    { schema: { params: IdParams, body: CreateCommentBody }, preHandler },
    async (request, reply) => {
      const adminUserId = BigInt((request.user as { sub: string }).sub)
      const comment = await createDealComment(db, request.params.id, adminUserId, request.body.text)
      return reply.code(201).send({ comment })
    },
  )
}
