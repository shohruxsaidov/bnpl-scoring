import type { FastifyInstance } from 'fastify'
import clientDealRoutes from './deals/routes'
import scoringRoutes from '../scoring/routes'

export default async function clientModule(app: FastifyInstance) {
  await app.register(clientDealRoutes, { prefix: '/client/deals' })
  await app.register(scoringRoutes, { prefix: '/client/scoring' })
}
