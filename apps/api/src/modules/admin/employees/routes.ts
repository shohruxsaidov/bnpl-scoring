import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listEmployeesByMerchant } from "./queries/list-employees"
import { getEmployee } from "./queries/get-employee"
import { updateEmployee } from "./commands/update-employee"
import { changeEmployeePassword } from "./commands/change-employee-password"

function serializeEmployee(e: NonNullable<Awaited<ReturnType<typeof getEmployee>>>) {
  return { ...e, id: e.id.toString(), merchantId: e.merchantId.toString(), branchId: e.branchId.toString() }
}

export default async function adminEmployeeRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  const IdParams = Type.Object({ id: Type.String() })
  const MerchantQuery = Type.Object({ merchantId: Type.String({ minLength: 1 }) })

  const preHandler = app.verifyAdminJwt

  /* ── GET /?merchantId=X — list employees for a merchant ──────────────────── */
  fastify.get(
    "/",
    { schema: { querystring: MerchantQuery }, preHandler },
    async (request) => {
      const rows = await listEmployeesByMerchant(db, Number(request.query.merchantId))
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
    { schema: { params: IdParams }, preHandler },
    async (request, reply) => {
      const employee = await getEmployee(db, Number(request.params.id))
      if (!employee) return reply.code(404).sendError("not_found")
      return { employee: serializeEmployee(employee) }
    },
  )

  fastify.patch(
    "/:id",
    { schema: { params: IdParams, body: UpdateEmployeeBody }, preHandler },
    async (request, reply) => {
      const employee = await updateEmployee(db, Number(request.params.id), request.body)
      if (!employee) return reply.code(404).sendError("not_found")
      return { employee: serializeEmployee(employee) }
    },
  )

  const ChangePasswordBody = Type.Object({
    password: Type.String({ minLength: 8 }),
  })

  fastify.post(
    "/:id/change-password",
    { schema: { params: IdParams, body: ChangePasswordBody }, preHandler },
    async (request, reply) => {
      const row = await changeEmployeePassword(db, Number(request.params.id), request.body.password)
      if (!row) return reply.code(404).sendError("not_found")
      return { ok: true }
    },
  )
}
