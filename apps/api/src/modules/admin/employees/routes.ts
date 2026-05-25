import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { getEmployee, updateEmployee } from "./service"

function serializeEmployee(e: NonNullable<Awaited<ReturnType<typeof getEmployee>>>) {
  return { ...e, id: e.id.toString(), merchantId: e.merchantId.toString(), branchId: e.branchId.toString() }
}

export default async function adminEmployeeRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  const IdParams = Type.Object({ id: Type.String() })

  const UpdateEmployeeBody = Type.Partial(
    Type.Object({
      fullName: Type.String({ minLength: 1 }),
      roles: Type.Array(
        Type.Union([
          Type.Literal("agent"),
          Type.Literal("branch_admin"),
          Type.Literal("merchant_admin"),
        ]),
        { minItems: 1 },
      ),
      active: Type.Boolean(),
    }),
  )

  const preHandler = app.verifyAdminJwt

  fastify.get(
    "/:id",
    { schema: { params: IdParams }, preHandler },
    async (request, reply) => {
      const employee = await getEmployee(db, BigInt(request.params.id))
      if (!employee) return reply.code(404).send({ code: "not_found" })
      return { employee: serializeEmployee(employee) }
    },
  )

  fastify.patch(
    "/:id",
    { schema: { params: IdParams, body: UpdateEmployeeBody }, preHandler },
    async (request, reply) => {
      const employee = await updateEmployee(db, BigInt(request.params.id), request.body)
      if (!employee) return reply.code(404).send({ code: "not_found" })
      return { employee: serializeEmployee(employee) }
    },
  )
}
