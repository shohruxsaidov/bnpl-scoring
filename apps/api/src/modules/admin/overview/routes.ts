import type { FastifyInstance } from 'fastify'
import { getMerchantHealth } from './service'

export default async function adminOverviewRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const merchantHealth = await getMerchantHealth(app.db)
    return { merchantHealth }
  })
}
