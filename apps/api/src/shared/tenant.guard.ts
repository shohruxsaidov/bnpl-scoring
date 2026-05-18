/**
 * Extracts tenant_id from the verified JWT and attaches it to the request.
 * Every tenant-scoped service MUST read `req.tenantId` and include it in
 * `WHERE tenant_id = $tenantId` (ADR 0002). Platform-admin tokens have no
 * tenant; those routes must not use this guard.
 */

import fp from "fastify-plugin";
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { AgentJwt, ClientJwt } from "@scoring/types";

declare module "fastify" {
  interface FastifyRequest {
    tenantId: string;
  }
  interface FastifyInstance {
    requireTenant: (
      req: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

export const tenantGuard = fp(async (app: FastifyInstance) => {
  app.decorateRequest("tenantId", "");

  app.decorate(
    "requireTenant",
    async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user as Partial<AgentJwt & ClientJwt>;
      const tenantId = user?.tenantId;
      if (!tenantId) {
        return reply.code(403).send({
          statusCode: 403,
          error: "forbidden",
          message: "Token is not tenant-scoped",
        });
      }
      req.tenantId = tenantId;
    },
  );
});
