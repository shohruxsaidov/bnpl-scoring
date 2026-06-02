import type { FastifyInstance } from 'fastify'
import merchantPushRoutes from './merchant-routes'

export default async function pushModule(app: FastifyInstance) {
  await app.register(merchantPushRoutes, { prefix: '/merchant/push' })
}
