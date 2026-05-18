import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import {
  CreateTenantBody,
  TenantListResponse,
  TenantSchema,
} from "./tenants.schema.js";
import { tenantsService } from "./tenants.service.js";
import { notFound } from "../../shared/errors.js";

const PatchTenantBody = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1 }),
    slug: Type.String({ minLength: 1 }),
    active: Type.Boolean(),
  }),
);

const ScoringModelBody = Type.Object({
  version: Type.String(),
  hardDenyThreshold: Type.Number(),
  partialLimitThreshold: Type.Number(),
  criteria: Type.Record(Type.String(), Type.Number()),
  rules: Type.Array(Type.String()),
});

const CreateTariffBody = Type.Object({
  name: Type.String({ minLength: 1 }),
  termMonths: Type.Integer({ minimum: 1 }),
  markupPercent: Type.Number({ minimum: 0 }),
});

const PatchTariffBody = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1 }),
    termMonths: Type.Integer({ minimum: 1 }),
    markupPercent: Type.Number({ minimum: 0 }),
    active: Type.Boolean(),
  }),
);

export async function tenantsRoutes(app: FastifyInstance): Promise<void> {
  const platformOnly = {
    onRequest: [app.authenticate, app.requireRole("platform_admin")],
  };

  // --- Tenant CRUD ---

  app.get(
    "/api/tenants",
    { ...platformOnly, schema: { response: { 200: TenantListResponse } } },
    async () => {
      const { data, total } = await tenantsService.list();
      return { data, total, page: 1, pageSize: data.length };
    },
  );

  app.get(
    "/api/tenants/:id",
    { ...platformOnly, schema: { response: { 200: TenantSchema } } },
    async (req) => {
      const { id } = req.params as { id: string };
      const tenant = await tenantsService.getById(id);
      if (!tenant) throw notFound("Tenant not found");
      return tenant;
    },
  );

  app.post(
    "/api/tenants",
    { ...platformOnly, schema: { body: CreateTenantBody } },
    async (req, reply) => {
      const tenant = await tenantsService.create(
        req.body as { name: string; slug: string },
      );
      return reply.code(201).send(tenant);
    },
  );

  app.patch(
    "/api/tenants/:id",
    { ...platformOnly, schema: { body: PatchTenantBody } },
    async (req) => {
      const { id } = req.params as { id: string };
      const updated = await tenantsService.update(id, req.body as object);
      if (!updated) throw notFound("Tenant not found");
      return updated;
    },
  );

  app.delete("/api/tenants/:id", platformOnly, async (req, reply) => {
    const { id } = req.params as { id: string };
    await tenantsService.softDelete(id);
    return reply.code(204).send();
  });

  // --- Scoring model sub-resource ---

  app.get("/api/tenants/:id/scoring-model", platformOnly, async (req) => {
    const { id } = req.params as { id: string };
    const model = await tenantsService.getScoringModel(id);
    if (!model) throw notFound("Scoring model not found");
    return model;
  });

  app.put(
    "/api/tenants/:id/scoring-model",
    { ...platformOnly, schema: { body: ScoringModelBody } },
    async (req) => {
      const { id } = req.params as { id: string };
      return tenantsService.updateScoringModel(id, req.body as object as Parameters<typeof tenantsService.updateScoringModel>[1]);
    },
  );

  // --- Per-tenant tariffs sub-resource ---

  app.get("/api/tenants/:id/tariffs", platformOnly, async (req) => {
    const { id } = req.params as { id: string };
    const data = await tenantsService.listTariffs(id);
    return { data, total: data.length, page: 1, pageSize: data.length };
  });

  app.post(
    "/api/tenants/:id/tariffs",
    { ...platformOnly, schema: { body: CreateTariffBody } },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const created = await tenantsService.createTariff(
        id,
        req.body as { name: string; termMonths: number; markupPercent: number },
      );
      return reply.code(201).send(created);
    },
  );

  app.patch(
    "/api/tenants/:id/tariffs/:tariffId",
    { ...platformOnly, schema: { body: PatchTariffBody } },
    async (req) => {
      const { id, tariffId } = req.params as { id: string; tariffId: string };
      const updated = await tenantsService.updateTariff(id, tariffId, req.body as object);
      if (!updated) throw notFound("Tariff not found");
      return updated;
    },
  );

  app.delete(
    "/api/tenants/:id/tariffs/:tariffId",
    platformOnly,
    async (req, reply) => {
      const { id, tariffId } = req.params as { id: string; tariffId: string };
      await tenantsService.softDeleteTariff(id, tariffId);
      return reply.code(204).send();
    },
  );
}
