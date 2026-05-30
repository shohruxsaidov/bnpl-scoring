import type { FastifyInstance } from 'fastify'
import { listPayments } from './service'

type JwtPayload = { sub: string; merchantId: string; branchId: string; role: string }

function payload(request: { user: unknown }) {
  return request.user as JwtPayload
}

export default async function merchantPaymentRoutes(app: FastifyInstance) {
  /* ── GET / — list payments (installment schedule rows) ───────────────── */
  app.get('/', { preHandler: app.verifyMerchantJwt }, async (request) => {
    const p = payload(request)
    const payments = await listPayments(app.db, BigInt(p.merchantId))
    return { payments }
  })
}
