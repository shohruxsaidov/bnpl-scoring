import type { FastifyInstance } from "fastify"
import { listUniqueClients } from "./queries/list-clients/list-clients.handler"
import { getClientOverview } from "./queries/get-client/get-client.handler"
import { listClientDeals } from "./queries/list-client-deals/list-client-deals.handler"
import { listClientScoring } from "./queries/list-client-scoring/list-client-scoring.handler"
import { listClientPayments } from "./queries/list-client-payments/list-client-payments.handler"

export default async function adminClientsRoutes(app: FastifyInstance) {
  app.get("/", async () => {
    const rows = await listUniqueClients()
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
    const client = await getClientOverview(id)
    if (!client) return reply.status(404).send({ error: "not_found" })
    return client
  })

  app.get<{ Params: { id: string } }>("/:id/deals", async (req) => {
    const id = Number(req.params.id)
    const dealsData = await listClientDeals(id)
    return { deals: dealsData }
  })

  app.get<{ Params: { id: string } }>("/:id/scoring", async (req) => {
    const id = Number(req.params.id)
    const history = await listClientScoring(id)
    return { history }
  })

  app.get<{ Params: { id: string } }>("/:id/payments", async (req) => {
    const id = Number(req.params.id)
    const payments = await listClientPayments(id)
    return { payments }
  })
}
