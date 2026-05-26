import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listBranches, createBranch, updateBranch } from "./service"

type MerchantPayload = { merchantId: string; role: string }

function merchantId(request: { user: unknown }) {
  return BigInt((request.user as MerchantPayload).merchantId)
}

function requireAdmin(request: { user: unknown }, reply: { code: (n: number) => { send: (b: unknown) => unknown } }) {
  if ((request.user as MerchantPayload).role !== "merchant_admin") {
    reply.code(403).send({ code: "forbidden" })
    return false
  }
  return true
}

function serialize(b: NonNullable<Awaited<ReturnType<typeof createBranch>>>) {
  return { ...b, id: b.id.toString(), merchantId: b.merchantId.toString() }
}

export default async function merchantBranchRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db
  const preHandler = app.verifyMerchantJwt

  const IdParams = Type.Object({ id: Type.String() })
  const CreateBody = Type.Object({
    name: Type.String({ minLength: 1 }),
    address: Type.String({ minLength: 1 }),
    phone: Type.String({ minLength: 1 }),
  })
  const UpdateBody = Type.Partial(Type.Object({
    name: Type.String({ minLength: 1 }),
    address: Type.String({ minLength: 1 }),
    phone: Type.String({ minLength: 1 }),
    active: Type.Boolean(),
  }))

  fastify.get("/", { preHandler }, async (request) => {
    const rows = await listBranches(db, merchantId(request))
    return { branches: rows.map(serialize) }
  })

  fastify.post("/", { schema: { body: CreateBody }, preHandler }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return
    const branch = await createBranch(db, { merchantId: merchantId(request), ...request.body })
    return reply.code(201).send({ branch: serialize(branch) })
  })

  fastify.patch("/:id", { schema: { params: IdParams, body: UpdateBody }, preHandler }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return
    const branch = await updateBranch(db, BigInt(request.params.id), merchantId(request), request.body)
    if (!branch) return reply.code(404).send({ code: "not_found" })
    return { branch: serialize(branch) }
  })
}
