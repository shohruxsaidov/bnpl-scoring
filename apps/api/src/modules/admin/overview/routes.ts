import type { FastifyInstance } from "fastify"
import { getMerchantHealth, getKybStats } from "./queries/get-dashboard-stats"

export default async function adminOverviewRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const [merchantHealth, kybStats] = await Promise.all([
      getMerchantHealth(app.db),
      getKybStats(app.db),
    ])
    return { merchantHealth, kybStats }
  })
}
