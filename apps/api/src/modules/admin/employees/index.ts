import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listEmployeesByMerchant } from "./queries/list-employees/list-employees.handler"
import { getEmployee } from "./queries/get-employee/get-employee.handler"
import { updateEmployee } from "./commands/update-employee/update-employee.handler"
import { changeEmployeePassword } from "./commands/change-employee-password/change-employee-password.handler"

function serializeEmployee(e: NonNullable<Awaited<ReturnType<typeof getEmployee>>>) {
  return { ...e, id: e.id.toString(), merchantId: e.merchantId.toString(), branchId: e.branchId.toString() }
}

const TAGS = ["Admin · Employees"]

export default async function adminEmployeeRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()

  const IdParams = Type.Object({ id: Type.String() })
  const MerchantQuery = Type.Object({ merchantId: Type.String({ minLength: 1 }) })

  const preHandler = app.verifyAdminJwt

  /* ── GET /?merchantId=X — list employees for a merchant ──────────────────── */
  fastify.get(
    "/",
    { schema: { tags: TAGS, querystring: MerchantQuery }, preHandler },
    async (request) => {
      const rows = await listEmployeesByMerchant(Number(request.query.merchantId))
      return { employees: rows.map((e) => ({ ...e, id: e.id.toString() })) }
    },
  )

  const UpdateEmployeeBody = Type.Partial(
    Type.Object({
      fullName: Type.String({ minLength: 1 }),
      roles: Type.Array(
        Type.Union([
          Type.Literal("agent"),
          Type.Literal("merchant_admin"),
        ]),
        { minItems: 1 },
      ),
      active: Type.Boolean(),
    }),
  )

  fastify.get(
    "/:id",
    { schema: { tags: TAGS, params: IdParams }, preHandler },
    async (request, reply) => {
      const employee = await getEmployee(Number(request.params.id))
      if (!employee) return reply.code(404).sendError("not_found")
      return { employee: serializeEmployee(employee) }
    },
  )

  fastify.patch(
    "/:id",
    { schema: { tags: TAGS, params: IdParams, body: UpdateEmployeeBody }, preHandler },
    async (request, reply) => {
      const employee = await updateEmployee({ id: Number(request.params.id), ...request.body })
      if (!employee) return reply.code(404).sendError("not_found")
      return { employee: serializeEmployee(employee) }
    },
  )

  const ChangePasswordBody = Type.Object({
    password: Type.String({ minLength: 8 }),
  })

  fastify.post(
    "/:id/change-password",
    { schema: { tags: TAGS, params: IdParams, body: ChangePasswordBody }, preHandler },
    async (request, reply) => {
      const row = await changeEmployeePassword(Number(request.params.id), request.body.password)
      if (!row) return reply.code(404).sendError("not_found")
      return { ok: true }
    },
  )

  fastify.delete(
    "/:id",
    { schema: { tags: TAGS, params: IdParams }, preHandler },
    async (request, reply) => {
      const employee = await updateEmployee({ id: Number(request.params.id), active: false })
      if (!employee) return reply.code(404).sendError("not_found")
      return { ok: true }
    },
  )
}
