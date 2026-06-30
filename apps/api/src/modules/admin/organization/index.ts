import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { getOrganization } from "./queries/get-organization/get-organization.handler"
import { upsertOrganization } from "./commands/upsert-organization/upsert-organization.handler"

function serialize(o: NonNullable<Awaited<ReturnType<typeof getOrganization>>>) {
  return {
    name: o.name,
    legalName: o.legalName,
    directorName: o.directorName,
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

  const TAGS = ["Admin · Organization"]

  const UpsertBody = Type.Object({
    name: Type.String({ minLength: 1, maxLength: 200 }),
    legalName: Type.String({ minLength: 1, maxLength: 200 }),
    directorName: Type.Optional(Type.String({ maxLength: 200 })),
    address: Type.String({ minLength: 1 }),
    phone: Type.String({ minLength: 1, maxLength: 20 }),
    inn: Type.String({ pattern: "^\\d{9}$" }),
    mfo: Type.String({ pattern: "^\\d{5}$" }),
    accountNumber: Type.String({ pattern: "^\\d{20}$" }),
    bankName: Type.String({ minLength: 1, maxLength: 200 }),
  })

  fastify.get("/", { schema: { tags: TAGS } }, async () => {
    const row = await getOrganization()
    return { organization: row ? serialize(row) : null }
  })

  fastify.put("/", { schema: { tags: TAGS, body: UpsertBody } }, async (request) => {
    const row = await upsertOrganization({
      ...request.body,
      directorName: request.body.directorName?.trim() || null,
    })
    return { organization: serialize(row) }
  })
}
