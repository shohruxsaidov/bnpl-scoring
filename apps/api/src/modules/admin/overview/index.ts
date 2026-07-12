import type { FastifyInstance } from "fastify"
import {
  getMerchantHealth,
  getKybStats,
  getStuckDealCount,
} from "./queries/get-dashboard-stats/get-dashboard-stats.handler"

const TAGS = ["Admin · Overview"]

export default async function adminOverviewRoutes(app: FastifyInstance) {
  app.get("/", { schema: { tags: TAGS } }, async () => {
    const [merchantHealth, kybStats, stuckDeals] = await Promise.all([
      getMerchantHealth(),
      getKybStats(),
      getStuckDealCount(),
    ])
    return { merchantHealth, kybStats, stuckDeals }
  })
}
