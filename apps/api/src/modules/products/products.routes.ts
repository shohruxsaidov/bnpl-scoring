import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { productsService } from "./products.service.js";
import { notFound } from "../../shared/errors.js";

const CreateProductBody = Type.Object({
  name: Type.String({ minLength: 1 }),
  sku: Type.String({ minLength: 1 }),
  price: Type.Integer({ minimum: 0 }),
  categoryId: Type.Optional(Type.String()),
});

const PatchProductBody = Type.Partial(
  Type.Object({
    name: Type.String({ minLength: 1 }),
    sku: Type.String({ minLength: 1 }),
    price: Type.Integer({ minimum: 0 }),
    categoryId: Type.String(),
    active: Type.Boolean(),
  }),
);

export async function productsRoutes(app: FastifyInstance): Promise<void> {
  const guard = { onRequest: [app.authenticate, app.requireTenant] };
  const adminGuard = {
    onRequest: [
      app.authenticate,
      app.requireTenant,
      app.requireRole("merchant_admin"),
    ],
  };

  app.get("/api/products", guard, async (req) => {
    const data = await productsService.list(req.tenantId);
    return { data, total: data.length, page: 1, pageSize: data.length };
  });

  app.post(
    "/api/products",
    { ...adminGuard, schema: { body: CreateProductBody } },
    async (req, reply) => {
      const created = await productsService.create(
        req.tenantId,
        req.body as { name: string; sku: string; price: number; categoryId?: string },
      );
      return reply.code(201).send(created);
    },
  );

  app.patch(
    "/api/products/:id",
    { ...adminGuard, schema: { body: PatchProductBody } },
    async (req) => {
      const { id } = req.params as { id: string };
      const updated = await productsService.update(req.tenantId, id, req.body as object);
      if (!updated) throw notFound("Product not found");
      return updated;
    },
  );

  app.delete("/api/products/:id", adminGuard, async (req, reply) => {
    const { id } = req.params as { id: string };
    await productsService.softDelete(req.tenantId, id);
    return reply.code(204).send();
  });
}
