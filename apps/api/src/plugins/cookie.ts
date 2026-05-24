import fp from "fastify-plugin";
import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";

export default fp(async function cookiePlugin(app: FastifyInstance) {
  await app.register(cookie);
});
