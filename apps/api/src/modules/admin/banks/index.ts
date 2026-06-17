import type { FastifyInstance } from "fastify"
import { getBankList } from "./queries/list-banks/list-banks.handler"
import { refreshBankList } from "./commands/refresh-banks/refresh-banks.handler"

export default async function adminBankRoutes(app: FastifyInstance) {
  app.get("/", { preHandler: app.verifyAdminJwt }, async () => {
    const banks = await getBankList()
    return { banks }
  })

  app.post("/refresh", { preHandler: app.verifyAdminJwt }, async () => {
    const banks = await refreshBankList()
    return { banks, count: banks.length }
  })
}
