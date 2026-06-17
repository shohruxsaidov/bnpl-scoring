import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listAdminUsers } from "./queries/list-users"
import { getAdminUser } from "./queries/get-user"
import { createAdminUser } from "./commands/create-user"
import { updateAdminUser } from "./commands/set-user-active"

type UserRow = NonNullable<Awaited<ReturnType<typeof getAdminUser>>>

function serialize(u: UserRow) {
  return {
    id: u.id.toString(),
    email: u.email,
    fullName: u.fullName,
    roleId: u.roleId?.toString() ?? null,
    roleName: u.roleName ?? null,
    roleKey: u.roleKey ?? null,
    isSuperAdmin: u.isSuperAdmin ?? false,
    active: u.active,
    createdAt: u.createdAt,
  }
}

export default async function adminUsersRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  const IdParams = Type.Object({ id: Type.String() })

  fastify.get("/", async () => {
    const rows = await listAdminUsers(db)
    return { users: rows.map(serialize) }
  })

  const CreateBody = Type.Object({
    email: Type.String({ format: "email" }),
    fullName: Type.String({ minLength: 1 }),
    password: Type.String({ minLength: 8 }),
    roleId: Type.String({ minLength: 1 }),
  })

  fastify.post("/", { schema: { body: CreateBody } }, async (request, reply) => {
    const createdById = Number((request.user as { sub: string }).sub)
    try {
      const created = await createAdminUser(db, {
        email: request.body.email,
        fullName: request.body.fullName,
        password: request.body.password,
        roleId: Number(request.body.roleId),
        createdById,
      })
      const user = await getAdminUser(db, created.id)
      if (!user) return reply.code(500).sendError("internal_error")
      return reply.code(201).send({ user: serialize(user) })
    } catch (err: any) {
      if (err?.code === "23505") return reply.code(409).sendError("email_taken")
      throw err
    }
  })

  const UpdateBody = Type.Partial(Type.Object({ active: Type.Boolean() }))

  fastify.patch("/:id", { schema: { params: IdParams, body: UpdateBody } }, async (request, reply) => {
    const updated = await updateAdminUser(db, Number(request.params.id), request.body)
    if (!updated) return reply.code(404).sendError("not_found")
    const user = await getAdminUser(db, updated.id)
    if (!user) return reply.code(404).sendError("not_found")
    return { user: serialize(user) }
  })
}
