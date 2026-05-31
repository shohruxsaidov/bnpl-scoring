import type { FastifyInstance } from 'fastify'
import pushRoutes from './routes'
import merchantPushRoutes from './merchant-routes'

export default async function pushModule(app: FastifyInstance) {
  await app.register(pushRoutes, { prefix: '/client/push' })
  await app.register(merchantPushRoutes, { prefix: '/merchant/push' })
}
