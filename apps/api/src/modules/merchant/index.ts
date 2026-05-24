import type { FastifyInstance } from "fastify";
import merchantClientRoutes from "./client/routes";

export default async function merchantModule(app: FastifyInstance) {
  await app.register(merchantClientRoutes, { prefix: "/merchant/client" });
}
