import { Type } from '@sinclair/typebox'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import type { FastifyInstance } from 'fastify'
import { listPayments } from './service'

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
}
