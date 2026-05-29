import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { listAdminDeals, getAdminDeal, payScheduleItem } from './service'

export default async function adminDealRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db
  const preHandler = app.verifyAdminJwt

  const ListQuery = Type.Object({
    status: Type.Optional(Type.String()),
    merchantId: Type.Optional(Type.String()),
  })

  const IdParams = Type.Object({ id: Type.String() })
  const PayParams = Type.Object({ id: Type.String(), index: Type.Integer({ minimum: 0 }) })
  const PayBody = Type.Object({ amount: Type.Integer({ minimum: 1 }) })

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

  /* POST /admin/deals/:id/schedule/:index/pay */
  fastify.post(
    '/:id/schedule/:index/pay',
    { schema: { params: PayParams, body: PayBody }, preHandler },
    async (request, reply) => {
      const deal = await getAdminDeal(db, request.params.id)
      if (!deal) return reply.code(404).send({ code: 'not_found' })

      const item = deal.schedule.find((s) => s.index === request.params.index)
      if (!item) return reply.code(404).send({ code: 'schedule_item_not_found' })
      if (item.paid) return reply.code(409).send({ code: 'already_paid' })

      const remaining = item.amount - item.paidAmount
      if (request.body.amount > remaining) {
        return reply.code(422).send({ code: 'amount_exceeds_remaining' })
      }

      return payScheduleItem(db, request.params.id, request.params.index, BigInt(request.body.amount))
    },
  )
}
