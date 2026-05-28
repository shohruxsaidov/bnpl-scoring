import type { FastifyInstance } from 'fastify'
import notificationRoutes from './routes'

export default async function notificationsModule(app: FastifyInstance) {
  await app.register(notificationRoutes, { prefix: '/notifications' })
}
