import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { CreateClientBody } from "./clients.schema.js";
import { clientsService } from "./clients.service.js";
import { notFound } from "../../shared/errors.js";

export async function clientsRoutes(app: FastifyInstance): Promise<void> {
  const guard = { onRequest: [app.authenticate, app.requireTenant] };

  app.get("/api/clients", guard, async (req) => {
    const { q } = req.query as { q?: string };
    const data = q
      ? await clientsService.search(req.tenantId, q)
      : await clientsService.list(req.tenantId);
    return { data, total: data.length, page: 1, pageSize: data.length };
  });

  app.get("/api/clients/:id", guard, async (req) => {
    const { id } = req.params as { id: string };
    const client = await clientsService.getById(req.tenantId, id);
    if (!client) throw notFound("Client not found");
    return client;
  });

  app.post(
    "/api/clients",
    { ...guard, schema: { body: CreateClientBody } },
    async (req, reply) => {
      const created = await clientsService.create(
        req.tenantId,
        req.body as { fullName: string; phone: string },
      );
      return reply.code(201).send(created);
    },
  );
}
