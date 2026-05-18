/**
 * Deals. GET /api/deals/:id returns the HEADER ONLY (ADR-driven); detail
 * tabs (schedule/overdue/accounting/autopayment/status) are separate
 * endpoints loaded lazily by the frontend. The wizard exposes an SSE
 * progress stream for MyID / KATM / PlumGate steps.
 */

import type { FastifyInstance } from "fastify";
import type { AgentJwt } from "@scoring/types";
import { CreateDealBody } from "./deals.schema.js";
import { dealsService } from "./deals.service.js";
import { notFound } from "../../shared/errors.js";

export async function dealsRoutes(app: FastifyInstance): Promise<void> {
  const guard = { onRequest: [app.authenticate, app.requireTenant] };

  app.get("/api/deals", guard, async (req) => {
    const data = await dealsService.list(req.tenantId);
    return { data, total: data.length, page: 1, pageSize: data.length };
  });

  app.post(
    "/api/deals",
    { ...guard, schema: { body: CreateDealBody } },
    async (req, reply) => {
      const { userId } = req.user as AgentJwt;
      const created = await dealsService.create(
        req.tenantId,
        userId,
        req.body as { clientId: string; tariffId: string; principal: number },
      );
      return reply.code(201).send(created);
    },
  );

  app.get("/api/deals/:id", guard, async (req) => {
    const { id } = req.params as { id: string };
    const deal = await dealsService.header(req.tenantId, id);
    if (!deal) throw notFound("Deal not found");
    return deal;
  });

  // --- Lazy sub-resources -------------------------------------------------

  app.get("/api/deals/:id/schedule", guard, async (req) => {
    const { id } = req.params as { id: string };
    return dealsService.schedule(req.tenantId, id);
  });

  app.get("/api/deals/:id/overdue", guard, async (req) => {
    const { id } = req.params as { id: string };
    return dealsService.overdue(req.tenantId, id);
  });

  app.get("/api/deals/:id/accounting", guard, async (req) => {
    const { id } = req.params as { id: string };
    return dealsService.accounting(req.tenantId, id);
  });

  app.get("/api/deals/:id/autopayment", guard, async (req) => {
    const { id } = req.params as { id: string };
    return dealsService.autopayment(req.tenantId, id);
  });

  app.get("/api/deals/:id/status", guard, async (req) => {
    const { id } = req.params as { id: string };
    return dealsService.status(req.tenantId, id);
  });

  // Wizard SSE progress moved to /api/wizard/sessions/:sessionId/progress (ADR 0011).
}
