import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { listBranches } from "./queries/list-branches/list-branches.handler"
import { createBranch } from "./commands/create-branch/create-branch.handler"
import { updateBranch } from "./commands/update-branch/update-branch.handler"

type MerchantPayload = { merchantId: string; role: string }

function merchantId(request: { user: unknown }) {
  return Number((request.user as MerchantPayload).merchantId)
}

function serialize(b: NonNullable<Awaited<ReturnType<typeof createBranch>>>) {
  return { ...b, id: b.id.toString(), merchantId: b.merchantId.toString() }
}

export default async function merchantBranchRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const preHandler = app.verifyMerchantJwt
  const manage = [app.verifyMerchantJwt, app.requirePermission("manage_branches")]

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
    const rows = await listBranches(merchantId(request))
    return { branches: rows.map(serialize) }
  })

  fastify.post("/", { schema: { body: CreateBody }, preHandler: manage }, async (request, reply) => {
    const branch = await createBranch({ merchantId: merchantId(request), ...request.body })
    return reply.code(201).send({ branch: serialize(branch) })
  })

  fastify.patch("/:id", { schema: { params: IdParams, body: UpdateBody }, preHandler: manage }, async (request, reply) => {
    const branch = await updateBranch(Number(request.params.id), merchantId(request), request.body)
    if (!branch) return reply.code(404).sendError("not_found")
    return { branch: serialize(branch) }
  })
}
