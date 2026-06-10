import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { getOrganization } from "./queries/get-organization"
import { upsertOrganization } from "./commands/upsert-organization"

function serialize(o: NonNullable<Awaited<ReturnType<typeof getOrganization>>>) {
  return {
    name: o.name,
    legalName: o.legalName,
    address: o.address,
    phone: o.phone,
    inn: o.inn,
    mfo: o.mfo,
    accountNumber: o.accountNumber,
    bankName: o.bankName,
    updatedAt: o.updatedAt.toISOString(),
  }
}

export default async function adminOrganizationRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  const UpsertBody = Type.Object({
    name: Type.String({ minLength: 1, maxLength: 200 }),
    legalName: Type.String({ minLength: 1, maxLength: 200 }),
    address: Type.String({ minLength: 1 }),
    phone: Type.String({ minLength: 1, maxLength: 20 }),
    inn: Type.String({ pattern: "^\\d{9}$" }),
    mfo: Type.String({ pattern: "^\\d{5}$" }),
    accountNumber: Type.String({ pattern: "^\\d{20}$" }),
    bankName: Type.String({ minLength: 1, maxLength: 200 }),
  })

  fastify.get("/", async () => {
    const row = await getOrganization(db)
    return { organization: row ? serialize(row) : null }
  })

  fastify.put("/", { schema: { body: UpsertBody } }, async (request) => {
    const row = await upsertOrganization(db, request.body)
    return { organization: serialize(row) }
  })
}
