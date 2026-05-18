/**
 * JWT plugin. Registers @fastify/jwt and exposes `authenticate` +
 * `requireRole` decorators. Three token shapes coexist (ADR 0004); the
 * verify step only proves signature — scoping is enforced by tenant.guard
 * and requireRole.
 */

import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import type { AgentJwt, ClientJwt, PlatformJwt, RoleName } from "@scoring/types";
import { config } from "../config.js";

type JwtUser = AgentJwt | PlatformJwt | ClientJwt;

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      req: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    requireRole: (
      ...roles: RoleName[]
    ) => (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtUser;
    user: JwtUser;
  }
}

export const authPlugin = fp(async (app: FastifyInstance) => {
  await app.register(jwt, { secret: config.jwtSecret });

  app.decorate(
    "authenticate",
    async (req: FastifyRequest, reply: FastifyReply) => {
      try {
        await req.jwtVerify();
      } catch {
        return reply
          .code(401)
          .send({ statusCode: 401, error: "unauthorized", message: "Invalid or missing token" });
      }
    },
  );

  app.decorate("requireRole", (...roles: RoleName[]) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      const user = req.user as JwtUser;
      const role =
        "role" in user ? user.role : ("client" as RoleName);
      if (!roles.includes(role)) {
        return reply.code(403).send({
          statusCode: 403,
          error: "forbidden",
          message: `Requires one of: ${roles.join(", ")}`,
        });
      }
    };
  });
});
