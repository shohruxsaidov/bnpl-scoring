import type { FastifyInstance } from "fastify"
import { getBankList } from "./queries/list-banks/list-banks.handler"
import { refreshBankList } from "./commands/refresh-banks/refresh-banks.handler"

export default async function adminBankRoutes(app: FastifyInstance) {
  const TAGS = ["Admin · Banks"]

  app.get("/", { schema: { tags: TAGS }, preHandler: app.verifyAdminJwt }, async () => {
    const banks = await getBankList()
    return { banks }
  })

  app.post("/refresh", { schema: { tags: TAGS }, preHandler: app.verifyAdminJwt }, async () => {
    const banks = await refreshBankList()
    return { banks, count: banks.length }
  })
}
