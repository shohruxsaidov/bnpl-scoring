import type { FastifyInstance } from "fastify"
import {
  getMerchantHealth,
  getKybStats,
  getStuckDealCount,
} from "./queries/get-dashboard-stats/get-dashboard-stats.handler"
import { countStrandedPlumSessions } from "../../client/payments/pay.service"

const TAGS = ["Admin · Overview"]

export default async function adminOverviewRoutes(app: FastifyInstance) {
  app.get("/", { schema: { tags: TAGS } }, async () => {
    // `blockedClients` was called `stuckDeals`. Renamed when the stuck-PAYMENTS
    // screen landed: one dashboard cannot have two different "stuck" numbers,
    // one meaning a client who cannot buy and the other meaning a client we owe
    // money. This one is the former — an expired schedule on an open deal.
    const [merchantHealth, kybStats, blockedClients, strandedPayments] = await Promise.all([
      getMerchantHealth(),
      getKybStats(),
      getStuckDealCount(),
      countStrandedPlumSessions(),
    ])
    return { merchantHealth, kybStats, blockedClients, strandedPayments }
  })
}
