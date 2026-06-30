import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listCategories } from "./queries/list-categories/list-categories.handler"
import { getCategory } from "./queries/get-category/get-category.handler"
import { createCategory } from "./commands/create-category/create-category.handler"
import { updateCategory } from "./commands/update-category/update-category.handler"

function serializeCategory(c: NonNullable<Awaited<ReturnType<typeof getCategory>>>) {
  return { ...c, id: c.id.toString() }
}

const TAGS = ["Admin · Categories"]

export default async function adminCategoryRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()

  const IdParams = Type.Object({ id: Type.String() })
  const CreateCategoryBody = Type.Object({ name: Type.String({ minLength: 1 }) })
  const UpdateCategoryBody = Type.Partial(Type.Object({ name: Type.String({ minLength: 1 }), active: Type.Boolean() }))

  const preHandler = app.verifyAdminJwt

  fastify.get("/", { schema: { tags: TAGS }, preHandler }, async () => {
    const rows = await listCategories()
    return { categories: rows.map(serializeCategory) }
  })

  fastify.post("/", { schema: { tags: TAGS, body: CreateCategoryBody }, preHandler }, async (request, reply) => {
    const category = await createCategory({ name: request.body.name })
    return reply.code(201).send({ category: serializeCategory(category) })
  })

  fastify.get("/:id", { schema: { tags: TAGS, params: IdParams }, preHandler }, async (request, reply) => {
    const category = await getCategory(Number(request.params.id))
    if (!category) return reply.code(404).sendError("not_found")
    return { category: serializeCategory(category) }
  })

  fastify.patch("/:id", { schema: { tags: TAGS, params: IdParams, body: UpdateCategoryBody }, preHandler }, async (request, reply) => {
    const category = await updateCategory({ id: Number(request.params.id), data: request.body })
    if (!category) return reply.code(404).sendError("not_found")
    return { category: serializeCategory(category) }
  })
}
