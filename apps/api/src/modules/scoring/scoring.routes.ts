import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { scoringService } from "./scoring.service.js";

export async function scoringRoutes(app: FastifyInstance): Promise<void> {
  const guard = { onRequest: [app.authenticate, app.requireTenant] };

  app.post(
    "/api/scoring/deals/:dealId",
    { ...guard, schema: { params: Type.Object({ dealId: Type.String() }) } },
    async (req) => {
      const { dealId } = req.params as { dealId: string };
      return scoringService.score(req.tenantId, dealId);
    },
  );

  app.get("/api/scoring/models", guard, async (req) => {
    const data = await scoringService.listModels(req.tenantId);
    return { data, total: data.length, page: 1, pageSize: data.length };
  });
}
