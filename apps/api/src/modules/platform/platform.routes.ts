/**
 * Platform-admin cross-tenant endpoints. No tenant_id — platform_admin JWT only.
 *  GET  /api/platform/deals
 *  GET  /api/platform/employees
 *  GET  /api/platform/integrations
 *  GET  /api/platform/config
 *  PATCH /api/platform/config
 */

import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { platformService } from "./platform.service.js";

const PatchConfigBody = Type.Record(
  Type.String(),
  Type.Union([Type.String(), Type.Number()]),
);

export async function platformRoutes(app: FastifyInstance): Promise<void> {
  const platformOnly = {
    onRequest: [app.authenticate, app.requireRole("platform_admin")],
  };

  app.get("/api/platform/deals", platformOnly, async () => {
    const data = await platformService.listDeals();
    return { data, total: data.length, page: 1, pageSize: data.length };
  });

  app.get("/api/platform/employees", platformOnly, async () => {
    const data = await platformService.listEmployees();
    return { data, total: data.length, page: 1, pageSize: data.length };
  });

  app.get("/api/platform/integrations", platformOnly, async () => {
    const data = await platformService.getIntegrations();
    return { data };
  });

  app.get("/api/platform/config", platformOnly, async () => {
    const data = await platformService.getConfig();
    return { data };
  });

  app.patch(
    "/api/platform/config",
    { ...platformOnly, schema: { body: PatchConfigBody } },
    async (req) => {
      const data = await platformService.updateConfig(req.body as Record<string, string | number>);
      return { data };
    },
  );
}
