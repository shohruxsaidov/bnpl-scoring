import type { FastifyInstance } from 'fastify'
import clientDealRoutes from './deals/routes'

export default async function clientModule(app: FastifyInstance) {
  await app.register(clientDealRoutes, { prefix: '/client/deals' })
}
