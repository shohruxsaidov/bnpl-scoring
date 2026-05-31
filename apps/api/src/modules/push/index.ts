import type { FastifyInstance } from 'fastify'
import pushRoutes from './routes'

export default async function pushModule(app: FastifyInstance) {
  await app.register(pushRoutes, { prefix: '/client/push' })
}
