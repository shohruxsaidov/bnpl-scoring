import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listEmployees, createEmployee, updateEmployee } from "./service"

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

function serialize(e: NonNullable<Awaited<ReturnType<typeof createEmployee>>>) {
  return { ...e, id: e.id.toString(), merchantId: e.merchantId.toString(), branchId: e.branchId.toString() }
}

export default async function merchantEmployeeRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db
  const preHandler = app.verifyMerchantJwt

  const IdParams = Type.Object({ id: Type.String() })

  const CreateBody = Type.Object({
    email: Type.String({ format: "email" }),
    password: Type.String({ minLength: 8 }),
    fullName: Type.String({ minLength: 1 }),
    branchId: Type.String(),
    roles: Type.Array(
      Type.Union([Type.Literal("agent"), Type.Literal("branch_admin"), Type.Literal("merchant_admin")]),
      { minItems: 1 },
    ),
  })

  const UpdateBody = Type.Partial(Type.Object({
    fullName: Type.String({ minLength: 1 }),
    branchId: Type.String(),
    roles: Type.Array(
      Type.Union([Type.Literal("agent"), Type.Literal("branch_admin"), Type.Literal("merchant_admin")]),
      { minItems: 1 },
    ),
    active: Type.Boolean(),
  }))

  fastify.get("/", { preHandler }, async (request) => {
    const rows = await listEmployees(db, merchantId(request))
    return { employees: rows.map(serialize) }
  })

  fastify.post("/", { schema: { body: CreateBody }, preHandler }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return
    const employee = await createEmployee(db, {
      email: request.body.email,
      password: request.body.password,
      fullName: request.body.fullName,
      merchantId: merchantId(request),
      branchId: BigInt(request.body.branchId),
      roles: request.body.roles,
    })
    return reply.code(201).send({ employee: serialize(employee) })
  })

  fastify.patch("/:id", { schema: { params: IdParams, body: UpdateBody }, preHandler }, async (request, reply) => {
    if (!requireAdmin(request, reply)) return
    const input = {
      ...request.body,
      branchId: request.body.branchId ? BigInt(request.body.branchId) : undefined,
    }
    const employee = await updateEmployee(db, BigInt(request.params.id), merchantId(request), input)
    if (!employee) return reply.code(404).send({ code: "not_found" })
    return { employee: serialize(employee) }
  })
}
