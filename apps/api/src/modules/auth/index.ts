import type { FastifyInstance } from "fastify";
import clientAuthRoutes from "./client/routes.js";
import merchantAuthRoutes from "./merchant/routes.js";
import adminAuthRoutes from "./admin/routes.js";

export default async function authModule(app: FastifyInstance) {
  await app.register(clientAuthRoutes, { prefix: "/auth/client" });
  await app.register(merchantAuthRoutes, { prefix: "/auth/merchant" });
  await app.register(adminAuthRoutes, { prefix: "/auth/admin" });
}
