import type { FastifyInstance } from "fastify"
import { listUniqueUsers } from "./queries/list-clients/list-clients.handler"
import { getUserOverview } from "./queries/get-client/get-client.handler"
import { listUserDeals } from "./queries/list-client-deals/list-client-deals.handler"
import { listUserScoring } from "./queries/list-client-scoring/list-client-scoring.handler"
import { listUserPayments } from "./queries/list-client-payments/list-client-payments.handler"

export default async function adminClientsRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const rows = await listUniqueUsers()
    return {
      clients: rows.map((r) => ({
        id: r.id,
        pinfl: r.pinfl,
        phone: r.phone,
        fullName: `${r.first_name} ${r.last_name}`,
        middleName: r.middle_name ?? null,
        birthDate: r.birth_date,
        createdAt: r.created_at,
      })),
    }
  })

  app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
    const id = Number(req.params.id)
    const user = await getUserOverview(id)
    if (!user) return reply.status(404).send({ error: "not_found" })
    return user
  })

  app.get<{ Params: { id: string } }>("/:id/deals", async (req) => {
    const id = Number(req.params.id)
    const dealsData = await listUserDeals(id)
    return { deals: dealsData }
  })

  app.get<{ Params: { id: string } }>("/:id/scoring", async (req) => {
    const id = Number(req.params.id)
    const history = await listUserScoring(id)
    return { history }
  })

  app.get<{ Params: { id: string } }>("/:id/payments", async (req) => {
    const id = Number(req.params.id)
    const payments = await listUserPayments(id)
    return { payments }
  })
}
