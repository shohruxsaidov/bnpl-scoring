import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { tariffsService } from "./tariffs.service.js";
import { notFound } from "../../shared/errors.js";

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

export async function tariffsRoutes(app: FastifyInstance): Promise<void> {
  const guard = { onRequest: [app.authenticate, app.requireTenant] };
  const adminGuard = {
    onRequest: [
      app.authenticate,
      app.requireTenant,
      app.requireRole("merchant_admin"),
    ],
  };

  app.get("/api/tariffs", guard, async (req) => {
    const data = await tariffsService.list(req.tenantId);
    return { data, total: data.length, page: 1, pageSize: data.length };
  });

  app.post(
    "/api/tariffs",
    { ...adminGuard, schema: { body: CreateTariffBody } },
    async (req, reply) => {
      const created = await tariffsService.create(
        req.tenantId,
        req.body as { name: string; termMonths: number; markupPercent: number },
      );
      return reply.code(201).send(created);
    },
  );

  app.patch(
    "/api/tariffs/:id",
    { ...adminGuard, schema: { body: PatchTariffBody } },
    async (req) => {
      const { id } = req.params as { id: string };
      const updated = await tariffsService.update(req.tenantId, id, req.body as object);
      if (!updated) throw notFound("Tariff not found");
      return updated;
    },
  );

  app.delete("/api/tariffs/:id", adminGuard, async (req, reply) => {
    const { id } = req.params as { id: string };
    await tariffsService.softDelete(req.tenantId, id);
    return reply.code(204).send();
  });
}
