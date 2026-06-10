import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listTariffs } from "./queries/list-tariffs"
import { getTariff } from "./queries/get-tariff"
import { getTariffMerchants } from "./queries/get-tariff-merchants"
import { createTariff } from "./commands/create-tariff"
import { updateTariff } from "./commands/update-tariff"

function serialize(t: NonNullable<Awaited<ReturnType<typeof getTariff>>>) {
  return {
    id: t.id.toString(),
    name: t.name,
    termMonths: t.termMonths,
    markupPercent: parseFloat(t.markupPercent),
    active: t.active,
    createdAt: t.createdAt.toISOString(),
  }
}

export default async function adminTariffRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db
  const preHandler = app.verifyAdminJwt

  const IdParams = Type.Object({ id: Type.String() })

  const CreateBody = Type.Object({
    name: Type.String({ minLength: 1 }),
    termMonths: Type.Integer({ minimum: 1, maximum: 120 }),
    markupPercent: Type.Number({ minimum: 0, maximum: 100 }),
  })

  const UpdateBody = Type.Partial(
    Type.Object({
      name: Type.String({ minLength: 1 }),
      termMonths: Type.Integer({ minimum: 1, maximum: 120 }),
      markupPercent: Type.Number({ minimum: 0, maximum: 100 }),
      active: Type.Boolean(),
    }),
  )

  fastify.get("/", { preHandler }, async () => {
    const rows = await listTariffs(db)
    return { tariffs: rows.map(serialize) }
  })

  fastify.post("/", { schema: { body: CreateBody }, preHandler }, async (request, reply) => {
    const { markupPercent, ...rest } = request.body
    const tariff = await createTariff(db, { ...rest, markupPercent: markupPercent.toFixed(2) })
    return reply.code(201).send({ tariff: serialize(tariff) })
  })

  fastify.patch("/:id", { schema: { params: IdParams, body: UpdateBody }, preHandler }, async (request, reply) => {
    const { markupPercent, ...rest } = request.body
    const input = {
      ...rest,
      ...(markupPercent !== undefined && { markupPercent: markupPercent.toFixed(2) }),
    }
    const tariff = await updateTariff(db, BigInt(request.params.id), input)
    if (!tariff) return reply.code(404).sendError("not_found")
    return { tariff: serialize(tariff) }
  })

  fastify.delete("/:id", { schema: { params: IdParams }, preHandler }, async (request, reply) => {
    const tariff = await updateTariff(db, BigInt(request.params.id), { active: false })
    if (!tariff) return reply.code(404).sendError("not_found")
    return { tariff: serialize(tariff) }
  })

  fastify.get("/:id/merchants", { schema: { params: IdParams }, preHandler }, async (request) => {
    const rows = await getTariffMerchants(db, BigInt(request.params.id))
    return {
      merchants: rows.map((m) => ({
        id: m.id.toString(),
        name: m.name,
        legalName: m.legalName,
        inn: m.inn,
        active: m.active,
        addedAt: m.addedAt.toISOString(),
      })),
    }
  })
}
