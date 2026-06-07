import type { FastifyInstance } from "fastify"
import { getBankList, refreshBankList } from "./service"

export default async function adminBankRoutes(app: FastifyInstance) {
  const db = app.db

  app.get("/", { preHandler: app.verifyAdminJwt }, async () => {
    const banks = await getBankList(db)
    return { banks }
  })

  app.post("/refresh", { preHandler: app.verifyAdminJwt }, async () => {
    const banks = await refreshBankList(db)
    return { banks, count: banks.length }
  })
}
