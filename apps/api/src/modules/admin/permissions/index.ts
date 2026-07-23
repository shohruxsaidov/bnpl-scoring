import { Type } from "@sinclair/typebox"
import { StringEnum } from "@lib/typebox"
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox"
import type { FastifyInstance } from "fastify"
import {
  FEATURE_CATALOG,
  PROTECTED_ADMIN_FEATURES,
  isValidFeature,
  type Platform,
} from "../../../rbac/features"
import { listRoles } from "./queries/list-roles/list-roles.handler"
import { findRoleRow, keyExists, isRoleAssigned } from "./queries/get-role/get-role.handler"
import { createRole } from "./commands/create-role/create-role.handler"
import { renameRole } from "./commands/rename-role/rename-role.handler"
import { deleteRole } from "./commands/delete-role/delete-role.handler"
import { setRolePermissions } from "./commands/set-role-permissions/set-role-permissions.handler"

const PLATFORMS: Platform[] = ["merchant", "admin"]

export default async function adminPermissionsRoutes(app: FastifyInstance) {
  const fastify = app.withTypeProvider<TypeBoxTypeProvider>()
  const preHandler = [app.verifyAdminJwt, app.requirePermission("manage_roles")]

  const TAGS = ["Admin · Permissions"]

  async function requesterIsSuperadmin(request: { user: unknown }): Promise<boolean> {
    const roleId = (request.user as { roleId: string | null }).roleId
    if (!roleId) return false
    const resolved = await app.resolveRole(Number(roleId))
    return resolved?.isSuperAdmin ?? false
  }

  async function requesterFeatures(request: { user: unknown }): Promise<Set<string>> {
    const roleId = (request.user as { roleId: string | null }).roleId
    if (!roleId) return new Set()
    const resolved = await app.resolveRole(Number(roleId))
    return resolved?.features ?? new Set()
  }

  fastify.get("/catalog", { schema: { tags: TAGS }, preHandler }, async () => {
    return { catalog: FEATURE_CATALOG }
  })

  const ListQuery = Type.Object({
    platform: Type.Optional(StringEnum(["merchant", "admin"] as const)),
  })

  fastify.get("/roles", { schema: { tags: TAGS, querystring: ListQuery }, preHandler }, async (request) => {
    const rolesList = await listRoles(request.query.platform)
    return { roles: rolesList }
  })

  const CreateRoleBody = Type.Object({
    platform: Type.Union([Type.Literal("merchant"), Type.Literal("admin")]),
    key: Type.String({ minLength: 1, maxLength: 50, pattern: "^[a-z][a-z0-9_]*$" }),
    name: Type.String({ minLength: 1, maxLength: 100 }),
  })

  fastify.post("/roles", { schema: { tags: TAGS, body: CreateRoleBody }, preHandler }, async (request, reply) => {
    const { platform, key, name } = request.body
    if (key === "superadmin") {
      return reply.code(400).sendError("reserved_key")
    }
    if (await keyExists(platform, key)) {
      return reply.code(409).sendError("key_taken")
    }
    const role = await createRole({ platform, key, name })
    return reply.code(201).send({
      role: {
        id: role.id.toString(),
        key: role.key,
        name: role.name,
        platform: role.platform,
        isSuperAdmin: role.isSuperAdmin,
        isSystem: role.isSystem,
        features: [],
      },
    })
  })

  const IdParams = Type.Object({ id: Type.String() })
  const RenameBody = Type.Object({ name: Type.String({ minLength: 1, maxLength: 100 }) })

  fastify.patch(
    "/roles/:id",
    { schema: { tags: TAGS, params: IdParams, body: RenameBody }, preHandler },
    async (request, reply) => {
      const role = await findRoleRow(Number(request.params.id))
      if (!role) return reply.code(404).sendError("not_found")
      if (role.isSuperAdmin) return reply.code(403).sendError("immutable_role")
      const updated = await renameRole(role.id, request.body.name)
      return { role: { id: updated!.id.toString(), name: updated!.name } }
    },
  )

  fastify.delete("/roles/:id", { schema: { tags: TAGS, params: IdParams }, preHandler }, async (request, reply) => {
    const role = await findRoleRow(Number(request.params.id))
    if (!role) return reply.code(404).sendError("not_found")
    if (role.isSuperAdmin || role.isSystem) {
      return reply.code(403).sendError("protected_role")
    }
    if (await isRoleAssigned(role)) {
      return reply.code(409).sendError("role_in_use")
    }
    await deleteRole(role.id)
    app.invalidateRole(role.id)
    return { ok: true }
  })

  const SetPermsBody = Type.Object({ features: Type.Array(Type.String()) })

  fastify.put(
    "/roles/:id/permissions",
    { schema: { tags: TAGS, params: IdParams, body: SetPermsBody }, preHandler },
    async (request, reply) => {
      const role = await findRoleRow(Number(request.params.id))
      if (!role) return reply.code(404).sendError("not_found")
      if (role.isSuperAdmin) return reply.code(403).sendError("immutable_role")

      const platform = role.platform as Platform
      if (!PLATFORMS.includes(platform)) {
        return reply.code(400).sendError("invalid_platform")
      }

      const requested = [...new Set(request.body.features)]
      for (const f of requested) {
        if (!isValidFeature(platform, f)) {
          return reply.code(400).sendError("invalid_feature", { feature: f })
        }
      }

      if (platform === "admin" && !(await requesterIsSuperadmin(request))) {
        const held = await requesterFeatures(request)
        for (const f of requested) {
          if (PROTECTED_ADMIN_FEATURES.includes(f as never) || !held.has(f)) {
            return reply.code(403).sendError("escalation_blocked", { feature: f })
          }
        }
      }

      await setRolePermissions(role.id, requested)
      app.invalidateRole(role.id)
      return { ok: true, features: requested }
    },
  )
}
