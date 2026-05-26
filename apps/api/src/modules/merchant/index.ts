import type { FastifyInstance } from "fastify"
import merchantClientRoutes from "./client/routes"
import merchantCatalogRoutes from "./catalog/routes"
import merchantBranchRoutes from "./branches/routes"
import merchantEmployeeRoutes from "./employees/routes"

export default async function merchantModule(app: FastifyInstance) {
  await app.register(merchantClientRoutes, { prefix: "/merchant/client" })
  await app.register(merchantCatalogRoutes, { prefix: "/merchant/catalog" })
  await app.register(merchantBranchRoutes, { prefix: "/merchant/branches" })
  await app.register(merchantEmployeeRoutes, { prefix: "/merchant/employees" })
}
