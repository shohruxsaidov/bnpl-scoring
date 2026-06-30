import type { FastifyInstance } from "fastify";

export default async function healthRoutes(app: FastifyInstance) {
  const TAGS = ["Health"];

  app.get("/health", { schema: { tags: TAGS } }, async () => {
    return { status: "ok" };
  });
}
