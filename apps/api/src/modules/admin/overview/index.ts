import type { FastifyInstance } from "fastify"
import { getMerchantHealth, getKybStats } from "./queries/get-dashboard-stats/get-dashboard-stats.handler"

export default async function adminOverviewRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const [merchantHealth, kybStats] = await Promise.all([
      getMerchantHealth(),
      getKybStats(),
    ])
    return { merchantHealth, kybStats }
  })
}
