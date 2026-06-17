import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listCategories } from "./queries/list-categories"
import { getCategory } from "./queries/get-category"
import { createCategory } from "./commands/create-category"
import { updateCategory } from "./commands/update-category"

function serializeCategory(c: NonNullable<Awaited<ReturnType<typeof getCategory>>>) {
  return { ...c, id: c.id.toString() }
}

export default async function adminCategoryRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db

  const IdParams = Type.Object({ id: Type.String() })
  const CreateCategoryBody = Type.Object({ name: Type.String({ minLength: 1 }) })
  const UpdateCategoryBody = Type.Partial(Type.Object({ name: Type.String({ minLength: 1 }), active: Type.Boolean() }))

  const preHandler = app.verifyAdminJwt

  fastify.get("/", { preHandler }, async () => {
    const rows = await listCategories(db)
    return { categories: rows.map(serializeCategory) }
  })

  fastify.post("/", { schema: { body: CreateCategoryBody }, preHandler }, async (request, reply) => {
    const category = await createCategory(db, { name: request.body.name })
    return reply.code(201).send({ category: serializeCategory(category) })
  })

  fastify.get("/:id", { schema: { params: IdParams }, preHandler }, async (request, reply) => {
    const category = await getCategory(db, Number(request.params.id))
    if (!category) return reply.code(404).sendError("not_found")
    return { category: serializeCategory(category) }
  })

  fastify.patch("/:id", { schema: { params: IdParams, body: UpdateCategoryBody }, preHandler }, async (request, reply) => {
    const category = await updateCategory(db, Number(request.params.id), request.body)
    if (!category) return reply.code(404).sendError("not_found")
    return { category: serializeCategory(category) }
  })
}
