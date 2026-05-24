import fp from "fastify-plugin";
import jwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { env } from "../env.js";

declare module "fastify" {
  interface FastifyInstance {
    /**
     * Route-level preHandler that verifies the `access_token` cookie.
     * Populates `request.user` with the decoded access-token payload on success,
     * otherwise replies 401 and short-circuits the request.
     */
    verifyClientJwt: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    // Decoded payload exposed on `request.user` after `jwtVerify()`.
    // Reg-token payloads are verified explicitly via `app.jwt.verify<T>()`.
    user: { sub: string; type: "client" };
  }
}

export default fp(async function jwtPlugin(app: FastifyInstance) {
  await app.register(jwt, {
    secret: env.JWT_SECRET,
    sign: { expiresIn: env.JWT_EXPIRES_IN },
    cookie: { cookieName: "access_token", signed: false },
  });

  app.decorate(
    "verifyClientJwt",
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        await request.jwtVerify();
      } catch {
        await reply.code(401).send({ code: "unauthorized" });
      }
    },
  );
});
