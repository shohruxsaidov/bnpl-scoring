import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { listPayments, listManualPayments, createManualPayment, searchDealsForManualPayment } from './service'

export default async function adminPaymentRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db
  const preHandler = app.verifyAdminJwt

  const ListQuery = Type.Object({
    merchantId: Type.Optional(Type.String()),
  })

  /* GET /admin/payments */
  fastify.get('/', { schema: { querystring: ListQuery }, preHandler }, async (request) => {
    const { merchantId } = request.query
    const payments = await listPayments(db, {
      merchantId: merchantId ? BigInt(merchantId) : undefined,
    })
    return { payments }
  })

  /* GET /admin/payments/manual/deals?q=CN-0000001 */
  fastify.get(
    '/manual/deals',
    { schema: { querystring: Type.Object({ q: Type.String() }) }, preHandler },
    async (request) => {
      const deals = await searchDealsForManualPayment(db, request.query.q)
      return { deals }
    },
  )

  /* GET /admin/payments/manual */
  fastify.get('/manual', { preHandler }, async () => {
    const payments = await listManualPayments(db)
    return { payments }
  })

  /* POST /admin/payments/manual */
  const CreateBody = Type.Object({
    dealId: Type.String({ format: 'uuid' }),
    amount: Type.Integer({ minimum: 1 }),
    paymentType: Type.Union([Type.Literal('mib'), Type.Literal('transfer')]),
    note: Type.Optional(Type.String()),
  })

  fastify.post(
    '/manual',
    { schema: { body: CreateBody }, preHandler },
    async (request, reply) => {
      const adminUserId = BigInt((request.user as { sub: string }).sub)
      try {
        const payment = await createManualPayment(db, { ...request.body, adminUserId })
        return reply.status(201).send({ payment })
      } catch (err: any) {
        if (err.code === 'OVERPAYMENT') {
          return reply.status(400).send({ code: 'OVERPAYMENT', message: err.message })
        }
        throw err
      }
    },
  )
}
