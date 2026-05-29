import type { FastifyInstance } from 'fastify'
import { getCollectionBoard } from './service'

type JwtPayload = { sub: string; merchantId: string; branchId: string; role: string }

function payload(request: { user: unknown }) {
  return request.user as JwtPayload
}

export default async function collectionBoardRoutes(app: FastifyInstance) {
  /* ── GET / — aging bucket board ──────────────────────────────────────── */
  app.get('/', { preHandler: app.verifyMerchantJwt }, async (request) => {
    const p = payload(request)
    const buckets = await getCollectionBoard(app.db, BigInt(p.merchantId))
    return { buckets }
  })
}
