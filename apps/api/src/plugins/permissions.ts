import fp from 'fastify-plugin';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { eq } from 'drizzle-orm';
import { roles, rolePermissions } from '../modules/id/db/schema';

export interface ResolvedRole {
  isSuperAdmin: boolean;
  features: Set<string>;
}

declare module 'fastify' {
  interface FastifyInstance {
    // Resolves a role id to its Feature set, cached in memory.
    resolveRole: (roleId: number) => Promise<ResolvedRole | undefined>;
    // Drops a single role (or the whole cache) after a permission edit.
    invalidateRole: (roleId?: number) => void;
    // preHandler factory — rejects with 403 unless the actor's role holds `feature`
    // (Superadmin bypasses). Must run after a verify*Jwt preHandler.
    requirePermission: (
      feature: string,
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    // Method-aware variant: picks the read Feature for GET/HEAD and the write
    // Feature otherwise. A missing entry leaves that method unguarded.
    requirePermissionByMethod: (map: {
      read?: string;
      write?: string;
    }) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

function roleIdFromRequest(request: FastifyRequest): number | undefined {
  const user = request.user as { roleId?: string } | undefined;
  if (!user?.roleId) return undefined;
  try {
    return +user.roleId;
  } catch {
    return undefined;
  }
}

export default fp(async function permissionsPlugin(app: FastifyInstance) {
  // role id (string) -> resolved features. Invalidated on any grant/role edit.
  const cache = new Map<string, ResolvedRole>();

  async function resolveRole(roleId: number): Promise<ResolvedRole | undefined> {
    const key = roleId.toString();
    const cached = cache.get(key);
    if (cached) return cached;

    const [role] = await app.db
      .select({ id: roles.id, isSuperAdmin: roles.isSuperAdmin })
      .from(roles)
      .where(eq(roles.id, roleId))
      .limit(1);
    if (!role) return undefined;

    const grants = await app.db
      .select({ feature: rolePermissions.feature })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));

    const resolved: ResolvedRole = {
      isSuperAdmin: role.isSuperAdmin,
      features: new Set(grants.map((g) => g.feature)),
    };
    cache.set(key, resolved);
    return resolved;
  }

  app.decorate('resolveRole', resolveRole);

  app.decorate('invalidateRole', function invalidateRole(roleId?: number) {
    if (roleId === undefined) cache.clear();
    else cache.delete(roleId.toString());
  });

  app.decorate('requirePermission', function requirePermission(feature: string) {
    return async function (request: FastifyRequest, reply: FastifyReply) {
      const roleId = roleIdFromRequest(request);
      if (roleId === undefined) {
        return reply.code(403).send({ code: 'forbidden' });
      }
      const resolved = await resolveRole(roleId);
      if (!resolved) {
        return reply.code(403).send({ code: 'forbidden' });
      }
      if (resolved.isSuperAdmin || resolved.features.has(feature)) return;
      return reply.code(403).send({ code: 'forbidden' });
    };
  });

  app.decorate(
    'requirePermissionByMethod',
    function requirePermissionByMethod(map: { read?: string; write?: string }) {
      return async function (request: FastifyRequest, reply: FastifyReply) {
        const isRead = request.method === 'GET' || request.method === 'HEAD';
        const feature = isRead ? map.read : map.write;
        if (!feature) return;
        return app.requirePermission(feature)(request, reply);
      };
    },
  );
});
