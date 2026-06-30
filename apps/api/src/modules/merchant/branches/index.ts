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
  return { ...b, id: b.id.toString(), merchantId: b.merchantId.toString(), createdAt: b.createdAt.toISOString() }
}

// Reference docs metadata shared by every route in this module.
// This is the exemplar pattern — copy it when annotating other modules.
const TAGS = ["Merchant · Branches"]
const SECURITY = [{ merchantAuth: [] }]
const XLANG = [{ $ref: "#/components/parameters/xLang" }]
const ERROR = { $ref: "ErrorResponse#" }

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

  // Mirrors serialize(): bigint ids are emitted as strings.
  const Branch = Type.Object({
    id: Type.String(),
    merchantId: Type.String(),
    name: Type.String(),
    address: Type.String(),
    phone: Type.String(),
    regionId: Type.Union([Type.Integer(), Type.Null()]),
    active: Type.Boolean(),
    createdAt: Type.String({ format: "date-time" }),
  })

  fastify.get("/", {
    schema: {
      tags: TAGS,
      summary: "List branches",
      description: "Returns all branches for the authenticated merchant.",
      security: SECURITY,
      parameters: XLANG,
      response: { 200: Type.Object({ branches: Type.Array(Branch) }), 401: ERROR },
    },
    preHandler,
  }, async (request) => {
    const rows = await listBranches(merchantId(request))
    return { branches: rows.map(serialize) }
  })

  fastify.post("/", {
    schema: {
      tags: TAGS,
      summary: "Create branch",
      description: "Creates a branch. Requires the `manage_branches` permission.",
      security: SECURITY,
      parameters: XLANG,
      body: CreateBody,
      response: { 201: Type.Object({ branch: Branch }), 401: ERROR, 403: ERROR },
    },
    preHandler: manage,
  }, async (request, reply) => {
    const branch = await createBranch({ merchantId: merchantId(request), ...request.body })
    return reply.code(201).send({ branch: serialize(branch) })
  })

  fastify.patch("/:id", {
    schema: {
      tags: TAGS,
      summary: "Update branch",
      description: "Partially updates a branch. Requires the `manage_branches` permission.",
      security: SECURITY,
      parameters: XLANG,
      params: IdParams,
      body: UpdateBody,
      response: { 200: Type.Object({ branch: Branch }), 401: ERROR, 403: ERROR, 404: ERROR },
    },
    preHandler: manage,
  }, async (request, reply) => {
    const branch = await updateBranch(Number(request.params.id), merchantId(request), request.body)
    if (!branch) return reply.code(404).sendError("not_found")
    return { branch: serialize(branch) }
  })
}
