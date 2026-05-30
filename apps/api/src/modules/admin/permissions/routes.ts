import { Type } from "@sinclair/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import { eq, and } from "drizzle-orm"
import { rolePermissions } from "../../id/db/schema.js"

const ROLES = ["agent", "branch_admin", "merchant_admin"] as const
const FEATURES = ["view_deals_list", "create_deal", "view_admin_panel"] as const

export default async function adminPermissionsRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const db = app.db
  const preHandler = app.verifyAdminJwt

  fastify.get("/", { preHandler }, async () => {
    const rows = await db.select().from(rolePermissions)
    const matrix: Record<string, Record<string, boolean>> = {}
    for (const role of ROLES) {
      matrix[role] = {}
      for (const feature of FEATURES) {
        matrix[role]![feature] = true
      }
    }
    for (const row of rows) {
      if (matrix[row.role]) {
        matrix[row.role]![row.feature] = row.allowed
      }
    }
    return { permissions: matrix }
  })

  const UpdateBody = Type.Object({
    allowed: Type.Boolean(),
  })
  const Params = Type.Object({
    role: Type.String(),
    feature: Type.String(),
  })

  fastify.patch("/:role/:feature", { schema: { params: Params, body: UpdateBody }, preHandler }, async (request, reply) => {
    const { role, feature } = request.params
    if (!ROLES.includes(role as typeof ROLES[number]) || !FEATURES.includes(feature as typeof FEATURES[number])) {
      return reply.code(400).send({ code: "invalid_role_or_feature" })
    }
    await db
      .insert(rolePermissions)
      .values({ role, feature, allowed: request.body.allowed })
      .onConflictDoUpdate({ target: [rolePermissions.role, rolePermissions.feature], set: { allowed: request.body.allowed } })
    return { ok: true }
  })
}
