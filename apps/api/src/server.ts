/**
 * Fastify app bootstrap. Modular monolith: each module registers its own
 * routes; modules never import each other's internals (ADR 0001).
 */

import Fastify, { type FastifyError } from "fastify";
import { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import { config } from "./config.js";
import { closeDb } from "./shared/db.js";
import { authPlugin } from "./shared/auth.plugin.js";
import { tenantGuard } from "./shared/tenant.guard.js";
import { HttpError } from "./shared/errors.js";

import { agentAuthRoutes } from "./modules/auth/agent.routes.js";
import { platformAuthRoutes } from "./modules/auth/platform.routes.js";
import { clientAuthRoutes } from "./modules/auth/client.routes.js";
import { tenantsRoutes } from "./modules/tenants/tenants.routes.js";
import { employeesRoutes } from "./modules/employees/employees.routes.js";
import { clientsRoutes } from "./modules/clients/clients.routes.js";
import { dealsRoutes } from "./modules/deals/deals.routes.js";
import { scoringRoutes } from "./modules/scoring/scoring.routes.js";
import { tariffsRoutes } from "./modules/tariffs/tariffs.routes.js";
import { productsRoutes } from "./modules/products/products.routes.js";
import { paymentsRoutes } from "./modules/payments/payments.routes.js";
import { categoriesRoutes } from "./modules/categories/categories.routes.js";
import { wizardRoutes } from "./modules/wizard/wizard.routes.js";
import { platformRoutes } from "./modules/platform/platform.routes.js";
import { clientRoutes } from "./modules/client/client.routes.js";

export async function buildServer() {
  const app = Fastify({
    logger: { level: config.nodeEnv === "production" ? "info" : "debug" },
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.setErrorHandler((err: FastifyError, _req, reply) => {
    if (err instanceof HttpError) {
      return reply
        .code(err.statusCode)
        .send({ statusCode: err.statusCode, error: err.code, message: err.message });
    }
    if (err.validation) {
      return reply.code(400).send({
        statusCode: 400,
        error: "bad_request",
        message: err.message,
      });
    }
    app.log.error(err);
    return reply.code(500).send({
      statusCode: 500,
      error: "internal_error",
      message: "Internal server error",
    });
  });

  // Shared plugins (decorators) before routes that use them.
  await app.register(authPlugin);
  await app.register(tenantGuard);

  app.get("/health", async () => ({ status: "ok" }));

  // Modules.
  await app.register(agentAuthRoutes);
  await app.register(platformAuthRoutes);
  await app.register(clientAuthRoutes);
  await app.register(tenantsRoutes);
  await app.register(employeesRoutes);
  await app.register(clientsRoutes);
  await app.register(dealsRoutes);
  await app.register(scoringRoutes);
  await app.register(tariffsRoutes);
  await app.register(productsRoutes);
  await app.register(paymentsRoutes);
  await app.register(categoriesRoutes);
  await app.register(wizardRoutes);
  await app.register(platformRoutes);
  await app.register(clientRoutes);

  return app;
}

async function main() {
  const app = await buildServer();

  const shutdown = async () => {
    await app.close();
    await closeDb();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  try {
    await app.listen({ port: config.port, host: config.host });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Run only when executed directly (not when imported by tests).
const invokedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;
if (invokedDirectly) {
  void main();
}
