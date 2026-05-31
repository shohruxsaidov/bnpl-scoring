import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { listAdminDeals, getAdminDeal } from './service'

export default async function adminDealRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db
  const preHandler = app.verifyAdminJwt

  const ListQuery = Type.Object({
    status: Type.Optional(Type.String()),
    merchantId: Type.Optional(Type.String()),
  })

  const IdParams = Type.Object({ id: Type.String() })

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

}
