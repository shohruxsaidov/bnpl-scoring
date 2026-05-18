import type { FastifyInstance } from "fastify";
import { Type } from "@sinclair/typebox";
import { CreateEmployeeBody } from "./employees.schema.js";
import { employeesService } from "./employees.service.js";
import { notFound } from "../../shared/errors.js";

const PatchEmployeeBody = Type.Partial(
  Type.Object({
    fullName: Type.String({ minLength: 1 }),
    phone: Type.String({ minLength: 1 }),
    email: Type.String({ format: "email" }),
    active: Type.Boolean(),
  }),
);

export async function employeesRoutes(app: FastifyInstance): Promise<void> {
  const adminGuard = {
    onRequest: [
      app.authenticate,
      app.requireTenant,
      app.requireRole("merchant_admin"),
    ],
  };

  app.get("/api/employees", adminGuard, async (req) => {
    const data = await employeesService.list(req.tenantId);
    return { data, total: data.length, page: 1, pageSize: data.length };
  });

  app.post(
    "/api/employees",
    { ...adminGuard, schema: { body: CreateEmployeeBody } },
    async (req, reply) => {
      const created = await employeesService.create(
        req.tenantId,
        req.body as { fullName: string; phone: string; email?: string },
      );
      return reply.code(201).send(created);
    },
  );

  app.patch(
    "/api/employees/:id",
    { ...adminGuard, schema: { body: PatchEmployeeBody } },
    async (req) => {
      const { id } = req.params as { id: string };
      const updated = await employeesService.update(req.tenantId, id, req.body as object);
      if (!updated) throw notFound("Employee not found");
      return updated;
    },
  );
}
