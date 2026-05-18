import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { categoriesService } from "./categories.service.js";
import { notFound } from "../../shared/errors.js";

const CreateCategoryBody = Type.Object({
  name: Type.String({ minLength: 1 }),
  parentId: Type.Optional(Type.String()),
});

const PatchCategoryBody = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1 }),
    parentId: Type.String(),
  }),
);

export async function categoriesRoutes(app: FastifyInstance): Promise<void> {
  const guard = { onRequest: [app.authenticate, app.requireTenant] };
  const adminGuard = {
    onRequest: [
      app.authenticate,
      app.requireTenant,
      app.requireRole("merchant_admin"),
    ],
  };

  app.get("/api/categories", guard, async (req) => {
    const data = await categoriesService.list(req.tenantId);
    return { data, total: data.length, page: 1, pageSize: data.length };
  });

  app.post(
    "/api/categories",
    { ...adminGuard, schema: { body: CreateCategoryBody } },
    async (req, reply) => {
      const created = await categoriesService.create(
        req.tenantId,
        req.body as { name: string; parentId?: string },
      );
      return reply.code(201).send(created);
    },
  );

  app.patch(
    "/api/categories/:id",
    { ...adminGuard, schema: { body: PatchCategoryBody } },
    async (req) => {
      const { id } = req.params as { id: string };
      const updated = await categoriesService.update(req.tenantId, id, req.body as object);
      if (!updated) throw notFound("Category not found");
      return updated;
    },
  );

  app.delete("/api/categories/:id", adminGuard, async (req, reply) => {
    const { id } = req.params as { id: string };
    await categoriesService.softDelete(req.tenantId, id);
    return reply.code(204).send();
  });
}
